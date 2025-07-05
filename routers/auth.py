from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from datetime import timedelta
from database import get_db
from models.user import User
from schemas.auth import LoginRequest, TokenResponse, UserProfile
from schemas.user import UserCreate, UserResponse
from auth import create_access_token, verify_password, hash_password, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(login_request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    user = db.query(User).filter(User.username == login_request.username).first()
    
    if not user or not verify_password(login_request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/register", response_model=UserResponse)
async def register(user_create: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_create.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_create.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_create.password)
    db_user = User(
        username=user_create.username,
        email=user_create.email,
        hashed_password=hashed_password,
        role=user_create.role,
        is_active=user_create.is_active
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )
