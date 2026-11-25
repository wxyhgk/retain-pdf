// 阅读页「学习」页签：把 @retainpdf/reader 的第二栏口子接到 @retainpdf/learning 的学习区上。
// 阅读器和学习区互不认识，只在这里对接（docs/core/frontend/reader-side-pane.md）。
//
// 原型阶段只有一门写死的课（Szabo 第 3 章）：演示模式里一直有；真书只在那本 Szabo 的任务上出现。

import type { ReaderSidePanePort } from "@retainpdf/reader/contracts";
import { LearningPane, SZABO_CH3_COURSE, type LearningCourse } from "@retainpdf/learning";

import { isMockMode } from "@/platform/config/runtime.js";

const COURSES: LearningCourse[] = [SZABO_CH3_COURSE];

export function courseForReader(ids: { documentId: string; jobId: string }, mock = isMockMode()): LearningCourse | null {
  if (mock) return COURSES[0];
  return COURSES.find((course) => course.jobIds.includes(ids.jobId)) ?? null;
}

export const learningSidePanePort: ReaderSidePanePort = {
  label: "学习",
  isAvailableFor: (ids) => courseForReader(ids) !== null,
  render: (api) => {
    const course = courseForReader(api);
    if (!course) return null;
    return (
      <LearningPane
        key={course.id}
        course={course}
        host={{
          currentPage: api.currentPage,
          navigate: api.navigateToAnchor,
          setMarkers: api.setMarginMarkers,
          close: api.close,
        }}
      />
    );
  },
};
