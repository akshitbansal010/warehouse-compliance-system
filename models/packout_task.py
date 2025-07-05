from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PackoutTaskStatus(enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class PackoutTask(Base):
    __tablename__ = "packout_tasks"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    routing_guide_id = Column(Integer, ForeignKey("routing_guides.id"), nullable=False)
    status = Column(Enum(PackoutTaskStatus), nullable=False, default=PackoutTaskStatus.pending)
    instructions = Column(JSON)
    steps_completed = Column(JSON)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    order = relationship("Order", back_populates="packout_tasks")
    worker = relationship("User", back_populates="packout_tasks")
    routing_guide = relationship("RoutingGuide", back_populates="packout_tasks")
    compliance_photos = relationship("CompliancePhoto", back_populates="task")
