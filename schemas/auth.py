from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    admin = "admin"
    supervisor = "supervisor"
    worker = "worker"

class LoginRequest(BaseModel):
    username: str
    password: str

    @validator('username')
    def validate_username(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Username is required')
        return v.strip()

    @validator('password')
    def validate_password(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Password is required')
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
