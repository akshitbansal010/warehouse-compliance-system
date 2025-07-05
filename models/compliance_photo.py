from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PhotoType(enum.Enum):
    package = "package"
    label = "label"
    damage = "damage"
    compliance = "compliance"
    general = "general"

class ComplianceStatus(enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_review = "needs_review"

class CompliancePhoto(Base):
    __tablename__ = "compliance_photos"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("packout_tasks.id"), nullable=False)
    shipment_id = Column(String)
    file_path = Column(String, nullable=False)
    photo_type = Column(Enum(PhotoType), nullable=False, default=PhotoType.general)
    tags = Column(JSON)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    compliance_status = Column(Enum(ComplianceStatus), nullable=False, default=ComplianceStatus.pending)
    notes = Column(Text)

    # Relationships
    task = relationship("PackoutTask", back_populates="compliance_photos")
    worker = relationship("User", back_populates="compliance_photos")
