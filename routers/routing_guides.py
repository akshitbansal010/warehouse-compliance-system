from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from datetime import datetime
from database import get_db
from models.routing_guide import RoutingGuide, RoutingGuideStatus
from models.user import User
from auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/routing-guides", tags=["routing guides"])

# Pydantic schemas
class RoutingGuideBase(BaseModel):
    title: str
    description: Optional[str] = None

class RoutingGuideCreate(RoutingGuideBase):
    pass

class RoutingGuideUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[RoutingGuideStatus] = None

class RoutingGuideResponse(RoutingGuideBase):
    id: int
    file_path: str
    original_filename: str
    status: RoutingGuideStatus
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.post("/upload", response_model=RoutingGuideResponse)
async def upload_routing_guide(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new routing guide file."""
    # Validate file type
    allowed_extensions = {'.pdf', '.doc', '.docx', '.txt'}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not supported. Please upload PDF, DOC, DOCX, or TXT files."
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Create database record
    db_routing_guide = RoutingGuide(
        title=title,
        description=description,
        file_path=file_path,
        original_filename=file.filename,
        status=RoutingGuideStatus.uploading,
        created_by=current_user.id
    )
    
    db.add(db_routing_guide)
    db.commit()
    db.refresh(db_routing_guide)
    
    return db_routing_guide

@router.get("/", response_model=List[RoutingGuideResponse])
async def get_routing_guides(
    skip: int = 0,
    limit: int = 100,
    status: Optional[RoutingGuideStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all routing guides with optional filtering."""
    query = db.query(RoutingGuide)
    
    if status:
        query = query.filter(RoutingGuide.status == status)
    
    routing_guides = query.offset(skip).limit(limit).all()
    return routing_guides

@router.get("/{routing_guide_id}", response_model=RoutingGuideResponse)
async def get_routing_guide(
    routing_guide_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific routing guide by ID."""
    routing_guide = db.query(RoutingGuide).filter(RoutingGuide.id == routing_guide_id).first()
    
    if not routing_guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Routing guide not found"
        )
    
    return routing_guide

@router.put("/{routing_guide_id}", response_model=RoutingGuideResponse)
async def update_routing_guide(
    routing_guide_id: int,
    routing_guide_update: RoutingGuideUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a routing guide."""
    routing_guide = db.query(RoutingGuide).filter(RoutingGuide.id == routing_guide_id).first()
    
    if not routing_guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Routing guide not found"
        )
    
    # Check permissions - only creator or admin can update
    if routing_guide.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this routing guide"
        )
    
    # Update fields
    update_data = routing_guide_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(routing_guide, field, value)
    
    routing_guide.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(routing_guide)
    
    return routing_guide

@router.delete("/{routing_guide_id}")
async def delete_routing_guide(
    routing_guide_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a routing guide."""
    routing_guide = db.query(RoutingGuide).filter(RoutingGuide.id == routing_guide_id).first()
    
    if not routing_guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Routing guide not found"
        )
    
    # Check permissions - only creator or admin can delete
    if routing_guide.created_by != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this routing guide"
        )
    
    # Delete file from filesystem
    try:
        if os.path.exists(routing_guide.file_path):
            os.remove(routing_guide.file_path)
    except Exception as e:
        # Log error but don't fail the deletion
        print(f"Warning: Failed to delete file {routing_guide.file_path}: {str(e)}")
    
    # Delete from database
    db.delete(routing_guide)
    db.commit()
    
    return {"message": "Routing guide deleted successfully"}
