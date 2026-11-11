from app.contracts.desktop import DesktopActionRequest
from app.infrastructure.desktop_action_repository import DesktopActionRepository


class DesktopService:
    def __init__(self, repository: DesktopActionRepository) -> None:
        self.repository = repository

    async def request_action(self, request: DesktopActionRequest, user_id: str) -> dict:
        await self.repository.assert_member(request.workspace_id, user_id)
        await self.repository.get_device_for_owner(request.device_id, user_id)
        payload = {"path": request.path} if request.path else {"notification": request.notification.model_dump()}
        risk_tier = {"notify": 1, "open_file": 2, "open_folder": 2, "open_application": 3}[request.action_type]
        return await self.repository.create_action(request.workspace_id, user_id, request.device_id, request.action_type, payload, request.reason, risk_tier)
