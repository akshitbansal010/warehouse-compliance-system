from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from database import engine, Base
from routers import auth, routing_guides, websocket

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Warehouse Compliance Management System",
    description="A comprehensive warehouse compliance and routing guide management system with AI processing capabilities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS middleware to allow external host requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React admin dashboard
        "http://localhost:3001",  # Alternative port
        "https://*.clackypaas.com",  # Clacky environment
        "http://*.clackypaas.com",   # Clacky environment (HTTP)
    ],
    allow_origin_regex=r"https?://.*\.clackypaas\.com",  # Regex pattern for Clacky domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify API is running"""
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "message": "Warehouse Compliance Management System is running",
            "version": "1.0.0"
        }
    )

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Warehouse Compliance Management System API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(routing_guides.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")

# Global exception handler
@app.exception_handler(500)
async def internal_server_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred"
        }
    )

# 404 handler
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "The requested resource was not found"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
