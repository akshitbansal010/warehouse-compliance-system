from sqlalchemy import Column, Integer, String, JSON, DateTime, Enum, Time
from sqlalchemy.sql import func
from database import Base
import enum

class OrderStatus(enum.Enum):
    pending = "pending"
    processing = "processing"
    packed = "packed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"

class OrderPriority(enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    customer_info = Column(JSON)
    items = Column(JSON)
    shipping_address = Column(JSON)
    carrier = Column(String)
    service_type = Column(String)
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending)
    priority = Column(Enum(OrderPriority), nullable=False, default=OrderPriority.normal)
    cutoff_time = Column(Time)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
