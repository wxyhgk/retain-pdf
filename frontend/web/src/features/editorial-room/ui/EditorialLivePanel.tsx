// 书详情「进度」面板里的编辑部：翻译 agent 任务才出现，画面就是用户视图 EditorialStage。
// 任务在跑时跟着真实事件动；跑完 / 停下后停在最后的样子，可以点「回放」从头看一遍（循环播放）。
import { useState } from "react";
import { History, Square } from "lucide-react";

import { Button } from "@/ui/components/button.js";

import type { EditorialLive } from "../domain/live-feed.js";
import { EditorialRoomReplay } from "./EditorialRoomReplay.jsx";
import { EditorialStage } from "./EditorialStage.jsx";

export function EditorialLivePanel({ live, active }: { live: EditorialLive | null; active: boolean }) {
  const [replaying, setReplaying] = useState(false);
  if (!live?.events.length) return null;
  const canReplay = !active && live.events.length > 1;
  const showReplay = canReplay && replaying;
  return (
    <section className="editorial-room-live" aria-label="翻译编辑部" data-editorial-live={active ? "running" : "settled"}>
      {showReplay ? <EditorialRoomReplay events={live.events} /> : <EditorialStage state={live.state} />}
      {canReplay ? (
        <div className="editorial-room-live-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-editorial-live-replay={showReplay ? "on" : "off"}
            onClick={() => setReplaying((on) => !on)}
          >
            {showReplay ? <Square aria-hidden="true" /> : <History aria-hidden="true" />}
            {showReplay ? "停止回放" : "回放这次翻译"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
