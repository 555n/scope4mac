"""Ableton Link Sync — beat-sync metadata node.

Pure passthrough for video frames. Provides the Link Sync parameter
schema/UI. The actual beat-gated frame output is handled by the
output track layer (tracks.py recv()), not by this pipeline node.

This node exists to:
1. Register in the pipeline list so users can add it
2. Provide the lookahead_frames config parameter
3. Pass through frames unchanged
"""

import logging

from ..interface import Pipeline, Requirements
from .schema import LinkSyncConfig

logger = logging.getLogger(__name__)


class LinkSyncPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return LinkSyncConfig

    def __init__(self, *, lookahead_frames=2, **kwargs):
        self.lookahead_frames = lookahead_frames
        logger.info("Ableton Link Sync initialized (passthrough, gate in output track)")

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            return None

        if isinstance(video, list):
            if len(video) == 0:
                return None
            video = video[0]

        return {"video": video}

    def reset(self):
        pass
