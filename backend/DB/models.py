import enum
import re
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import declarative_base, relationship, validates

SQLDeclarativeBase = declarative_base()


class Access(str, enum.Enum):
    public = "public"
    protected = "protected"
    private = "private"


class User(SQLDeclarativeBase):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    username = Column(String(50), nullable=False, unique=True)
    email = Column(String(254), nullable=False, unique=True)
    password_hash = Column(
        String, nullable=True
    )  # If NULL then its verified from some of the OAuth providers.

    verified = Column(Boolean, default=False)
    verification_token = Column(
        UUID(as_uuid=True),
        unique=True,
        server_default=text("gen_random_uuid()"),
    )

    reset_password_code = Column(Integer, nullable=True)

    action_data = relationship(
        "Action", back_populates="user_data", passive_deletes=True
    )

    @validates("username")
    def validate_username(self, key, username):
        # allow only alphanumeric characters, underscores, and hyphens
        assert re.match(
            r"^[\w-]+$", username
        ), "Username should only contain alphanumeric characters, underscores, and hyphens"
        return username

    def __repr__(self):
        return f"User(id = {self.id}, username = {self.username}, email = {self.email})"


class Action(SQLDeclarativeBase):
    __tablename__ = "action"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(String, nullable=False)
    args = Column(JSON, nullable=False)
    train_samples = Column(JSON, nullable=True)

    user_data = relationship("User", back_populates="action_data")

    def __repr__(self):
        return f"Action(id = {self.id}, user_id = {self.user_id}, action = {self.action}, args = {self.args}, train_samples = {self.train_samples})"


class ModelZoo(SQLDeclarativeBase):
    __tablename__ = "modelzoo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    saved_path = Column(String, nullable=False, unique=True)
    trained_on = Column(String, nullable=False)
    num_params = Column(BigInteger, nullable=False)
    count = Column(Integer, nullable=False, default=0)
    is_indexed = Column(Boolean, nullable=False, default=False)
    size = Column(BigInteger, nullable=False)
    size_in_memory = Column(BigInteger, nullable=False)
    hash = Column(String, nullable=False, unique=True)
    thirdai_version = Column(String, nullable=False)
    access_level = Column(ENUM(Access), nullable=False, default=Access.public)
    match_substr = Column(String, nullable=False, default="")
    description = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    published_date = Column(
        DateTime, default=datetime.utcnow().isoformat(), nullable=True
    )
    author_email = Column(
        String, ForeignKey("users.email", ondelete="CASCADE"), nullable=False
    )
    author_username = Column(String, nullable=False)

    meta_data = relationship(
        "MetaData", back_populates="model_zoo", passive_deletes=True
    )

    @validates("name")
    def validate_username(self, key, name):
        # allow only alphanumeric characters, underscores, and hyphens
        assert re.match(
            r"^[\w-]+$", name
        ), "Model name should only contain alphanumeric characters, underscores, and hyphens"
        return name

    def __repr__(self):
        return (
            f"ModelZoo(id = {self.id}, saved_path = {self.saved_path}, name = {self.name}, trained_on = {self.trained_on}, num_params = {self.num_params},"
            f"count = {self.count}, is_indexed = {self.is_indexed}, size = {self.size}, hash = {self.hash}, thirdai_version = {self.thirdai_version},"
            f"access_level = {self.access_level}, author_email = {self.author_email}, author_username = {self.author_username})"
        )


# This class is to store any other information regarding
# models in different level of access.
class MetaData(SQLDeclarativeBase):
    __tablename__ = "metadata"

    model_id = Column(
        Integer,
        ForeignKey("modelzoo.id", ondelete="CASCADE"),
        primary_key=True,
    )
    private = Column(JSON, nullable=True)
    public = Column(JSON, nullable=True)
    protected = Column(JSON, nullable=True)

    model_zoo = relationship("ModelZoo", back_populates="meta_data")

    def __repr__(self):
        return f"MetaData(id = {self.model_id}, public = {self.public})"
