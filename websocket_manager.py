import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, List
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from enum import Enum

# Configure logging
logger = logging.getLogger(__name__)

class MessageType(str, Enum):
    TASK_UPDATE = "task_update"
    ORDER_STATUS = "order_status"
    ALERT = "alert"
    NOTIFICATION = "notification"
    SUPERVISOR_ALERT = "supervisor_alert"
    WORKER_STATUS = "worker_status"
    SYSTEM_MESSAGE = "system_message"

class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ConnectionManager:
    """Manages WebSocket connections for different user types and rooms"""
    
    def __init__(self):
        # Store active connections by user type and user ID
        self.active_connections: Dict[str, Dict[int, WebSocket]] = {
            "admin": {},
            "supervisor": {},
            "worker": {}
        }
        
        # Store connections by room/channel for targeted messaging
        self.rooms: Dict[str, Set[WebSocket]] = {}
        
        # Store user metadata for each connection
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        
        # Track connection statistics
        self.connection_stats = {
            "total_connections": 0,
            "active_workers": 0,
            "active_supervisors": 0,
            "active_admins": 0,
            "last_activity": datetime.utcnow()
        }

    async def connect(self, websocket: WebSocket, user_id: int, user_role: str, user_data: Dict[str, Any] = None):
        """Accept a new WebSocket connection and register the user"""
        try:
            await websocket.accept()
            
            # Store connection by role and user ID
            if user_role not in self.active_connections:
                self.active_connections[user_role] = {}
            
            # Close existing connection if user is already connected
            if user_id in self.active_connections[user_role]:
                await self.disconnect_user(user_id, user_role)
            
            self.active_connections[user_role][user_id] = websocket
            
            # Store connection metadata
            self.connection_metadata[websocket] = {
                "user_id": user_id,
                "user_role": user_role,
                "connected_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "user_data": user_data or {}
            }
            
            # Update statistics
            self.connection_stats["total_connections"] += 1
            self.connection_stats[f"active_{user_role}s"] += 1
            self.connection_stats["last_activity"] = datetime.utcnow()
            
            # Add to default room based on role
            await self.join_room(websocket, f"role_{user_role}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": MessageType.SYSTEM_MESSAGE,
                "message": "Connected to warehouse management system",
                "timestamp": datetime.utcnow().isoformat(),
                "user_role": user_role
            }, websocket)
            
            # Notify supervisors and admins of new worker connection
            if user_role == "worker":
                await self.broadcast_to_roles({
                    "type": MessageType.WORKER_STATUS,
                    "action": "connected",
                    "worker_id": user_id,
                    "worker_data": user_data,
                    "timestamp": datetime.utcnow().isoformat()
                }, ["supervisor", "admin"])
            
            logger.info(f"User {user_id} ({user_role}) connected via WebSocket")
            
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {str(e)}")
            raise

    async def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket and clean up"""
        try:
            metadata = self.connection_metadata.get(websocket)
            if not metadata:
                return
            
            user_id = metadata["user_id"]
            user_role = metadata["user_role"]
            
            # Remove from active connections
            if user_role in self.active_connections and user_id in self.active_connections[user_role]:
                del self.active_connections[user_role][user_id]
            
            # Remove from all rooms
            for room_connections in self.rooms.values():
                room_connections.discard(websocket)
            
            # Remove metadata
            del self.connection_metadata[websocket]
            
            # Update statistics
            self.connection_stats["total_connections"] -= 1
            if f"active_{user_role}s" in self.connection_stats:
                self.connection_stats[f"active_{user_role}s"] -= 1
            
            # Notify supervisors and admins of worker disconnection
            if user_role == "worker":
                await self.broadcast_to_roles({
                    "type": MessageType.WORKER_STATUS,
                    "action": "disconnected",
                    "worker_id": user_id,
                    "timestamp": datetime.utcnow().isoformat()
                }, ["supervisor", "admin"])
            
            logger.info(f"User {user_id} ({user_role}) disconnected from WebSocket")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {str(e)}")

    async def disconnect_user(self, user_id: int, user_role: str):
        """Disconnect a specific user by ID and role"""
        try:
            if user_role in self.active_connections and user_id in self.active_connections[user_role]:
                websocket = self.active_connections[user_role][user_id]
                await websocket.close()
                await self.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error disconnecting user {user_id}: {str(e)}")

    async def join_room(self, websocket: WebSocket, room_name: str):
        """Add a WebSocket connection to a specific room"""
        if room_name not in self.rooms:
            self.rooms[room_name] = set()
        self.rooms[room_name].add(websocket)

    async def leave_room(self, websocket: WebSocket, room_name: str):
        """Remove a WebSocket connection from a specific room"""
        if room_name in self.rooms:
            self.rooms[room_name].discard(websocket)
            if not self.rooms[room_name]:
                del self.rooms[room_name]

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
            
            # Update last activity
            if websocket in self.connection_metadata:
                self.connection_metadata[websocket]["last_activity"] = datetime.utcnow()
                
        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")

    async def send_to_user(self, message: Dict[str, Any], user_id: int, user_role: str):
        """Send a message to a specific user by ID and role"""
        try:
            if user_role in self.active_connections and user_id in self.active_connections[user_role]:
                websocket = self.active_connections[user_role][user_id]
                await self.send_personal_message(message, websocket)
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {str(e)}")

    async def broadcast_to_room(self, message: Dict[str, Any], room_name: str):
        """Broadcast a message to all connections in a specific room"""
        if room_name not in self.rooms:
            return
        
        disconnected_connections = []
        
        for websocket in self.rooms[room_name].copy():
            try:
                await self.send_personal_message(message, websocket)
            except WebSocketDisconnect:
                disconnected_connections.append(websocket)
            except Exception as e:
                logger.error(f"Error broadcasting to room {room_name}: {str(e)}")
                disconnected_connections.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected_connections:
            await self.disconnect(websocket)

    async def broadcast_to_roles(self, message: Dict[str, Any], roles: List[str]):
        """Broadcast a message to all users with specific roles"""
        for role in roles:
            if role in self.active_connections:
                for websocket in list(self.active_connections[role].values()):
                    try:
                        await self.send_personal_message(message, websocket)
                    except Exception as e:
                        logger.error(f"Error broadcasting to role {role}: {str(e)}")

    async def broadcast_to_all(self, message: Dict[str, Any]):
        """Broadcast a message to all connected users"""
        all_connections = []
        for role_connections in self.active_connections.values():
            all_connections.extend(role_connections.values())
        
        disconnected_connections = []
        
        for websocket in all_connections:
            try:
                await self.send_personal_message(message, websocket)
            except WebSocketDisconnect:
                disconnected_connections.append(websocket)
            except Exception as e:
                logger.error(f"Error broadcasting to all: {str(e)}")
                disconnected_connections.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected_connections:
            await self.disconnect(websocket)

    def get_connected_users(self, role: Optional[str] = None) -> Dict[str, Any]:
        """Get information about connected users"""
        if role:
            return {
                "role": role,
                "count": len(self.active_connections.get(role, {})),
                "users": list(self.active_connections.get(role, {}).keys())
            }
        
        return {
            "total": self.connection_stats["total_connections"],
            "by_role": {
                role: {
                    "count": len(connections),
                    "users": list(connections.keys())
                }
                for role, connections in self.active_connections.items()
            },
            "statistics": self.connection_stats
        }

    async def send_task_update(self, task_data: Dict[str, Any]):
        """Send task update to relevant users"""
        message = {
            "type": MessageType.TASK_UPDATE,
            "data": task_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to assigned worker
        if "worker_id" in task_data:
            await self.send_to_user(message, task_data["worker_id"], "worker")
        
        # Send to supervisors and admins
        await self.broadcast_to_roles(message, ["supervisor", "admin"])

    async def send_order_status_update(self, order_data: Dict[str, Any]):
        """Send order status update to relevant users"""
        message = {
            "type": MessageType.ORDER_STATUS,
            "data": order_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all supervisors and admins
        await self.broadcast_to_roles(message, ["supervisor", "admin"])
        
        # Send to worker if assigned
        if "assigned_worker_id" in order_data:
            await self.send_to_user(message, order_data["assigned_worker_id"], "worker")

    async def send_alert(self, alert_data: Dict[str, Any], level: AlertLevel = AlertLevel.INFO, target_roles: List[str] = None):
        """Send alert to specified roles or all users"""
        message = {
            "type": MessageType.ALERT,
            "level": level,
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if target_roles:
            await self.broadcast_to_roles(message, target_roles)
        else:
            await self.broadcast_to_all(message)

    async def send_supervisor_alert(self, alert_data: Dict[str, Any], level: AlertLevel = AlertLevel.WARNING):
        """Send alert specifically to supervisors and admins"""
        message = {
            "type": MessageType.SUPERVISOR_ALERT,
            "level": level,
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_roles(message, ["supervisor", "admin"])

    async def send_notification(self, notification_data: Dict[str, Any], user_id: int = None, user_role: str = None, target_roles: List[str] = None):
        """Send notification to specific user or roles"""
        message = {
            "type": MessageType.NOTIFICATION,
            "data": notification_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if user_id and user_role:
            await self.send_to_user(message, user_id, user_role)
        elif target_roles:
            await self.broadcast_to_roles(message, target_roles)
        else:
            await self.broadcast_to_all(message)

    async def handle_heartbeat(self, websocket: WebSocket):
        """Handle heartbeat/ping messages to keep connection alive"""
        try:
            await self.send_personal_message({
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)
        except Exception as e:
            logger.error(f"Error handling heartbeat: {str(e)}")

    async def cleanup_inactive_connections(self, timeout_minutes: int = 30):
        """Clean up connections that have been inactive for too long"""
        cutoff_time = datetime.utcnow().timestamp() - (timeout_minutes * 60)
        inactive_connections = []
        
        for websocket, metadata in self.connection_metadata.items():
            if metadata["last_activity"].timestamp() < cutoff_time:
                inactive_connections.append(websocket)
        
        for websocket in inactive_connections:
            try:
                await websocket.close()
                await self.disconnect(websocket)
                logger.info(f"Cleaned up inactive connection for user {self.connection_metadata.get(websocket, {}).get('user_id', 'unknown')}")
            except Exception as e:
                logger.error(f"Error cleaning up inactive connection: {str(e)}")

# Global connection manager instance
connection_manager = ConnectionManager()

# Utility functions for common operations
async def notify_task_completion(task_id: int, order_id: int, worker_id: int, completion_data: Dict[str, Any]):
    """Notify relevant users of task completion"""
    await connection_manager.send_task_update({
        "action": "completed",
        "task_id": task_id,
        "order_id": order_id,
        "worker_id": worker_id,
        "completion_data": completion_data
    })

async def notify_order_assigned(order_id: int, worker_id: int, order_data: Dict[str, Any]):
    """Notify users when an order is assigned to a worker"""
    await connection_manager.send_order_status_update({
        "action": "assigned",
        "order_id": order_id,
        "assigned_worker_id": worker_id,
        "order_data": order_data
    })

async def notify_compliance_issue(issue_data: Dict[str, Any]):
    """Notify supervisors of compliance issues"""
    await connection_manager.send_supervisor_alert({
        "type": "compliance_issue",
        "message": "Compliance issue detected",
        "details": issue_data
    }, AlertLevel.WARNING)

async def notify_system_status(status_data: Dict[str, Any], level: AlertLevel = AlertLevel.INFO):
    """Send system status updates to all users"""
    await connection_manager.send_alert({
        "type": "system_status",
        "message": "System status update",
        "details": status_data
    }, level)

async def broadcast_maintenance_notice(notice: str, scheduled_time: str = None):
    """Broadcast maintenance notices to all users"""
    await connection_manager.send_notification({
        "type": "maintenance_notice",
        "message": notice,
        "scheduled_time": scheduled_time
    })
