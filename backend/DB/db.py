import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from settings import get_settings

from .models import SQLDeclarativeBase as Base


class SQLite:
    def __init__(self, name="logger"):
        THIS_FOLDER = os.path.abspath(os.path.dirname(__file__))
        db_path = os.path.join(THIS_FOLDER, f"{name}.db")
        self._engine = create_engine(f"sqlite:///{db_path}")

    @property
    def engine(self):
        return self._engine


class LocalPostgres:
    def __init__(self, settings):
        self._postgres_uri = "postgresql://{user}:{password}@{uri}:{port}/{db}".format(
            **settings
        )

        self._engine = create_engine(url=self._postgres_uri, pool_size=10)

    @property
    def engine(self):
        return self._engine


class AzurePostgres:
    def __init__(self, settings):
        self._postgres_uri = (
            "postgresql://{user}:{password}@{uri}/{db}?sslmode=require".format(
                **settings
            )
        )

        self._engine = create_engine(self._postgres_uri)

    @property
    def engine(self):
        return self._engine


def get_engine():
    settings = get_settings()
    if settings:
        choice = settings["database"]["choice"]
        options = settings["database"]["options"]

        db_settings = options[choice]
        if choice == "sqlite":
            database_name = db_settings["name"]
            db = SQLite(database_name)
            return db.engine

        elif choice == "local":
            db = LocalPostgres(db_settings)
            return db.engine

        elif choice == "azure":
            db = AzurePostgres(db_settings)
            return db.engine

        else:
            raise ValueError("Currently only supports sqlite, local or azure postgres.")

    else:
        db = SQLite("database")
        return db.engine


engine = get_engine()

# https://docs.sqlalchemy.org/en/20/core/metadata.html#sqlalchemy.schema.MetaData.create_all
Base.metadata.create_all(engine)


Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# This function specifies a database dependency. Using this with fastapi.Depends
# internally converts it to a context manager and the database connection will
# close when going out of scope.
# Ref: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/
async def get_session_async():
    session = Session()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def get_session():
    session = Session()
    try:
        yield session
    finally:
        session.close()
