from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(24), default="student", index=True)
    email_verified: Mapped[bool] = mapped_column(default=False)
    oauth_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    assessments: Mapped[list["Assessment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tasks: Mapped[list["RoadmapTask"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    bookmarks: Mapped[list["Bookmark"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    study_sessions: Mapped[list["StudySession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    profile: Mapped["StudentProfile | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)

class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    answers: Mapped[list] = mapped_column(JSON)
    result_title: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(40), default="reflection-v1")
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="assessments")

class RoadmapTask(Base):
    __tablename__ = "roadmap_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    completed: Mapped[bool] = mapped_column(default=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0)
    logged_minutes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="tasks")
    study_sessions: Mapped[list["StudySession"]] = relationship(back_populates="task", cascade="all, delete-orphan")

class StudySession(Base):
    __tablename__ = "study_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("roadmap_tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    minutes: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="study_sessions")
    task: Mapped["RoadmapTask | None"] = relationship(back_populates="study_sessions")

class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="My resume")
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(back_populates="resumes")

class Bookmark(Base):
    __tablename__ = "bookmarks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[str] = mapped_column(String(32))
    item_id: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="bookmarks")
    __table_args__ = (UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_bookmark"),)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    provider: Mapped[str] = mapped_column(String(40), default="local-guidance")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="chat_messages")

class StudentProfile(Base):
    __tablename__ = "student_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    education_stage: Mapped[str] = mapped_column(String(80), default="College student")
    preferred_language: Mapped[str] = mapped_column(String(16), default="en")
    location: Mapped[str] = mapped_column(String(120), default="")
    interests: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(back_populates="profile")


class DataImport(Base):
    __tablename__ = "data_imports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dataset_type: Mapped[str] = mapped_column(String(80), default="college_cutoffs")
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="validated")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CollegeCutoff(Base):
    __tablename__ = "college_cutoffs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_id: Mapped[int | None] = mapped_column(ForeignKey("data_imports.id", ondelete="SET NULL"), index=True, nullable=True)
    exam: Mapped[str] = mapped_column(String(40), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    college_name: Mapped[str] = mapped_column(String(240), index=True)
    course: Mapped[str] = mapped_column(String(240), index=True)
    state: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    quota: Mapped[str] = mapped_column(String(80))
    round: Mapped[str] = mapped_column(String(40))
    closing_rank: Mapped[int] = mapped_column(Integer, index=True)
    source_url: Mapped[str] = mapped_column(String(1000))
    source_checked_on: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    scope: Mapped[str] = mapped_column(String(40), index=True)
    bucket_start: Mapped[int] = mapped_column(Integer)
    request_count: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[int] = mapped_column(Integer, index=True)
