from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class RoutingGuideStatus(enum.Enum):
    uploading = "uploading"
    processing = "processing"
    active = "active"
    inactive = "inactive"
    error = "error"

class RoutingGuide(Base):
    __tablename__ = "routing_guides"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    parsed_content = Column(JSON)
    ai_extracted_rules = Column(JSON)
    status = Column(Enum(RoutingGuideStatus), nullable=False, default=RoutingGuideStatus.uploading)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", back_populates="routing_guides")
