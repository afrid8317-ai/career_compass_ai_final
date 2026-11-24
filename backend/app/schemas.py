from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Any

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=128)
    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) > 255 or value.count("@") != 1 or "." not in value.rsplit("@", 1)[-1] or any(ch.isspace() for ch in value):
            raise ValueError("Enter a valid email address.")
        return value
    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2: raise ValueError("Name must contain at least 2 non-space characters.")
        return value
    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 1024: raise ValueError("Password is too long.")
        return value

class UserLogin(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) > 255 or value.count("@") != 1 or "." not in value.rsplit("@", 1)[-1] or any(ch.isspace() for ch in value):
            raise ValueError("Enter a valid email address.")
        return value
    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 1024: raise ValueError("Password is too long.")
        return value

class UserOut(BaseModel):
    id: int; name: str; email: str
    model_config = ConfigDict(from_attributes=True)
class TokenOut(BaseModel):
    access_token: str; token_type: str = "bearer"; user: UserOut
class AssessmentIn(BaseModel):
    answers: list[int] = Field(min_length=5, max_length=60)
    version: str = Field(default="reflection-v1", max_length=40)
class AssessmentOut(BaseModel):
    id: int; answers: list[int]; result_title: str; created_at: datetime
    version: str = "reflection-v1"; scores: dict[str, int] = {}
    model_config = ConfigDict(from_attributes=True)
class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=240)
    estimated_minutes: int | None = Field(default=0, ge=0, le=6000)
class TaskUpdate(BaseModel):
    completed: bool | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, le=6000)
class TaskTimeLogIn(BaseModel):
    minutes: int = Field(ge=5, le=600)
    note: str = Field(default="", max_length=200)
class TaskOut(BaseModel):
    id: int; title: str; completed: bool; estimated_minutes: int = 0; logged_minutes: int = 0; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class CollegeSearchIn(BaseModel):
    exam: str = Field(min_length=2, max_length=40)
    score: str | None = Field(default=None, max_length=40)
    rank: str | None = Field(default=None, max_length=40)
    category: str | None = Field(default=None, max_length=80)
    course: str | None = Field(default=None, max_length=120)
    courses: list[str] = Field(default_factory=list, max_length=30)
    quota: str | None = Field(default=None, max_length=80)
    round: str | None = Field(default=None, max_length=40)
    region: str = Field(min_length=2, max_length=80)
    year: int | None = Field(default=None, ge=2000, le=2100)
class ResumeIn(BaseModel):
    title: str = Field(default="My resume", min_length=1, max_length=160)
    content: dict[str, Any]
class ResumeAnalysisIn(BaseModel):
    content: dict[str, Any]
    job_description: str = Field(default="", max_length=12000)
class ChatIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    career_id: str | None = Field(default=None, max_length=100)
class BookmarkIn(BaseModel):
    item_type: str = Field(pattern="^(career|college|job|resource)$")
    item_id: str = Field(min_length=1, max_length=160)
class ProfileIn(BaseModel):
    education_stage: str = Field(default="College student", max_length=80)
    preferred_language: str = Field(default="en", pattern="^(en|kn|hi)$")
    location: str = Field(default="", max_length=120)
    interests: list[str] = Field(default_factory=list, max_length=30)

class EmailRequest(BaseModel):
    email: str = Field(max_length=255)

class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    new_password: str = Field(min_length=8, max_length=128)

class TokenConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
