"""
Database configuration for VAANEE SHIELD.

Uses SQLite for local/dev simplicity. Swap SQLALCHEMY_DATABASE_URL with a
Postgres/MySQL DSN in production (e.g. postgresql+psycopg2://user:pass@host/db).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./vaanee_shield.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
