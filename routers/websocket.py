from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from typing import Optional, Dict, Any
import json
import logging
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from auth import verify_token
from websocket_manager import connection_manager, MessageType, AlertLevel
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

async def get_current_user_websocket(token: str, db: Session):
    """Get current user from WebSocket token parameter"""
    try:
        payload = verify_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Inactive user")
        
        return user
    except Exception as e:
        logger.error(f"WebSocket authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Main WebSocket endpoint for real-time communication"""
    user = None
    try:
        # Authenticate user
        user = await get_current_user_websocket(token, db)
        
        # Connect user to WebSocket manager
        await connection_manager.connect(
            websocket=websocket,
            user_id=user.id,
            user_role=user.role.value,
            user_data={
                "username": user.username,
                "email": user.email,
                "connected_at": datetime.utcnow().isoformat()
            }
        )
        
        # Main message handling loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_client_message(websocket, user, message)
                
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)
            except Exception as e:
                logger.error(f"WebSocket message handling error: {str(e)}")
                await connection_manager.send_personal_message({
                    "type": "error",
                    "message": "Message processing error",
                    "timestamp": datetime.utcnow().isoformat()
                }, websocket)
                
    except HTTPException:
        # Authentication failed
        await websocket.close(code=4001, reason="Authentication failed")
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
        await websocket.close(code=4000, reason="Connection error")
    finally:
        # Clean up connection
        if user:
            await connection_manager.disconnect(websocket)

async def handle_client_message(websocket: WebSocket, user: User, message: Dict[str, Any]):
    """Handle messages received from WebSocket clients"""
    message_type = message.get("type")
    
    if message_type == "ping":
        await connection_manager.handle_heartbeat(websocket)
    
    elif message_type == "subscribe":
        # Subscribe to specific channels/rooms
        channel = message.get("channel")
        if channel:
            await connection_manager.join_room(websocket, channel)
            await connection_manager.send_personal_message({
                "type": "subscription_confirmed",
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)
    
    elif message_type == "unsubscribe":
        # Unsubscribe from channels/rooms
        channel = message.get("channel")
        if channel:
            await connection_manager.leave_room(websocket, channel)
            await connection_manager.send_personal_message({
                "type": "unsubscription_confirmed",
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)
    
    elif message_type == "task_status_update":
        # Handle task status updates from workers
        if user.role.value == "worker":
            task_data = message.get("data", {})
            task_data["worker_id"] = user.id
            task_data["updated_by"] = user.username
            await connection_manager.send_task_update(task_data)
    
    elif message_type == "request_status":
        # Send current connection status
        status_info = connection_manager.get_connected_users()
        await connection_manager.send_personal_message({
            "type": "status_response",  
            "data": status_info,
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
    
    elif message_type == "broadcast_message":
        # Allow supervisors and admins to broadcast messages
        if user.role.value in ["supervisor", "admin"]:
            broadcast_data = message.get("data", {})
            target_roles = message.get("target_roles", ["worker"])
            
            await connection_manager.broadcast_to_roles({
                "type": MessageType.NOTIFICATION,
                "data": {
                    "message": broadcast_data.get("message", ""),
                    "from_user": user.username,
                    "from_role": user.role.value,
                    **broadcast_data
                },
                "timestamp": datetime.utcnow().isoformat()
            }, target_roles)
    
    else:
        await connection_manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)

# REST endpoints for WebSocket management

@router.get("/connections")
async def get_connections(
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user_websocket)
):
    """Get information about current WebSocket connections"""
    if current_user.role.value not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return connection_manager.get_connected_users(role)

@router.post("/broadcast")
async def broadcast_message(
    message_data: Dict[str, Any],
    target_roles: Optional[list] = None,
    current_user: User = Depends(get_current_user_websocket)
):
    """Broadcast message to specific roles or all users"""
    if current_user.role.value not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to broadcast messages"
        )
    
    broadcast_message = {
        "type": MessageType.NOTIFICATION,
        "data": {
            **message_data,
            "from_user": current_user.username,
            "from_role": current_user.role.value,
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if target_roles:
        await connection_manager.broadcast_to_roles(broadcast_message, target_roles)
    else:
        await connection_manager.broadcast_to_all(broadcast_message)
    
    return {"message": "Broadcast sent successfully"}

@router.post("/alert")
async def send_alert(
    alert_data: Dict[str, Any],
    level: AlertLevel = AlertLevel.INFO,
    target_roles: Optional[list] = None,
    current_user: User = Depends(get_current_user_websocket)
):
    """Send alert to specified roles"""
    if current_user.role.value not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to send alerts"
        )
    
    # Add sender information to alert
    alert_data_with_sender = {
        **alert_data,
        "sent_by": current_user.username,
        "sent_by_role": current_user.role.value,
    }
    
    await connection_manager.send_alert(alert_data_with_sender, level, target_roles)
    
    return {"message": "Alert sent successfully"}

@router.post("/task-update")
async def send_task_update(
    task_data: Dict[str, Any],
    current_user: User = Depends(get_current_user_websocket)
):
    """Send task update notification"""
    if current_user.role.value not in ["supervisor", "admin", "worker"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Add sender information
    task_data_with_sender = {
        **task_data,
        "updated_by": current_user.username,
        "updated_by_role": current_user.role.value,
    }
    
    await connection_manager.send_task_update(task_data_with_sender)
    
    return {"message": "Task update sent successfully"}

@router.post("/order-status")
async def send_order_status_update(
    order_data: Dict[str, Any],
    current_user: User = Depends(get_current_user_websocket)
):
    """Send order status update notification"""
    if current_user.role.value not in ["supervisor", "admin", "worker"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Add sender information
    order_data_with_sender = {
        **order_data,
        "updated_by": current_user.username,
        "updated_by_role": current_user.role.value,
    }
    
    await connection_manager.send_order_status_update(order_data_with_sender)
    
    return {"message": "Order status update sent successfully"}

@router.post("/supervisor-alert")
async def send_supervisor_alert(
    alert_data: Dict[str, Any],
    level: AlertLevel = AlertLevel.WARNING,
    current_user: User = Depends(get_current_user_websocket)
):
    """Send alert specifically to supervisors and admins"""
    # Add sender information
    alert_data_with_sender = {
        **alert_data,
        "reported_by": current_user.username,
        "reported_by_role": current_user.role.value,
    }
    
    await connection_manager.send_supervisor_alert(alert_data_with_sender, level)
    
    return {"message": "Supervisor alert sent successfully"}

@router.post("/notification")
async def send_notification(
    notification_data: Dict[str, Any],
    user_id: Optional[int] = None,
    user_role: Optional[str] = None,
    target_roles: Optional[list] = None,
    current_user: User = Depends(get_current_user_websocket)
):
    """Send notification to specific user or roles"""
    # Add sender information
    notification_data_with_sender = {
        **notification_data,
        "from_user": current_user.username,
        "from_role": current_user.role.value,
    }
    
    await connection_manager.send_notification(
        notification_data_with_sender,
        user_id,
        user_role,
        target_roles
    )
    
    return {"message": "Notification sent successfully"}

@router.delete("/disconnect/{user_id}")
async def disconnect_user(
    user_id: int,
    user_role: str,
    current_user: User = Depends(get_current_user_websocket)
):
    """Disconnect a specific user (admin only)"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can disconnect users"
        )
    
    await connection_manager.disconnect_user(user_id, user_role)
    
    return {"message": f"User {user_id} disconnected successfully"}

@router.post("/cleanup")
async def cleanup_inactive_connections(
    timeout_minutes: int = 30,
    current_user: User = Depends(get_current_user_websocket)
):
    """Clean up inactive connections (admin only)"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can cleanup connections"
        )
    
    await connection_manager.cleanup_inactive_connections(timeout_minutes)
    
    return {"message": "Inactive connections cleaned up successfully"}

# Utility endpoints for specific warehouse operations

@router.post("/notify/task-completion")
async def notify_task_completion(
    task_id: int,
    order_id: int,
    worker_id: int,
    completion_data: Dict[str, Any],
    current_user: User = Depends(get_current_user_websocket)
):
    """Notify users of task completion"""
    from websocket_manager import notify_task_completion
    
    await notify_task_completion(task_id, order_id, worker_id, completion_data)
    
    return {"message": "Task completion notification sent"}

@router.post("/notify/order-assigned")
async def notify_order_assigned(
    order_id: int,
    worker_id: int,
    order_data: Dict[str, Any],
    current_user: User = Depends(get_current_user_websocket)
):
    """Notify users when order is assigned"""
    from websocket_manager import notify_order_assigned
    
    await notify_order_assigned(order_id, worker_id, order_data)
    
    return {"message": "Order assignment notification sent"}

@router.post("/notify/compliance-issue")
async def notify_compliance_issue(
    issue_data: Dict[str, Any],
    current_user: User = Depends(get_current_user_websocket)
):
    """Notify supervisors of compliance issues"""
    from websocket_manager import notify_compliance_issue
    
    await notify_compliance_issue(issue_data)
    
    return {"message": "Compliance issue notification sent"}

@router.post("/notify/system-status")
async def notify_system_status(
    status_data: Dict[str, Any],
    level: AlertLevel = AlertLevel.INFO,
    current_user: User = Depends(get_current_user_websocket)
):
    """Send system status updates"""
    if current_user.role.value not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    from websocket_manager import notify_system_status
    
    await notify_system_status(status_data, level)
    
    return {"message": "System status notification sent"}

@router.post("/notify/maintenance")
async def broadcast_maintenance_notice(
    notice: str,
    scheduled_time: Optional[str] = None,
    current_user: User = Depends(get_current_user_websocket)
):
    """Broadcast maintenance notices"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can send maintenance notices"
        )
    
    from websocket_manager import broadcast_maintenance_notice
    
    await broadcast_maintenance_notice(notice, scheduled_time)
    
    return {"message": "Maintenance notice broadcasted"}
