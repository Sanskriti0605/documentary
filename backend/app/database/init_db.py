import asyncio
from app.database.session import async_engine, Base
import app.database.models  # Register models

async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database tables initialized successfully.")
