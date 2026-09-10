"""Bind request cancellation to ASGI response lifetime, not generator collection."""
import anyio
from starlette.responses import StreamingResponse

from .request_control import RequestControl


class ControlledStreamingResponse(StreamingResponse):
    def __init__(self, content, *, control: RequestControl, **kwargs):
        super().__init__(content, **kwargs)
        self._control = control

    async def _cancel_request(self):
        # Transport close callbacks can block; never run them on the event loop.
        with anyio.CancelScope(shield=True):
            await anyio.to_thread.run_sync(self._control.cancel)

    async def listen_for_disconnect(self, receive):
        await super().listen_for_disconnect(receive)
        await self._cancel_request()

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # Also covers send failures / ASGI 2.4, which do not use the listener.
            await self._cancel_request()
