/**
 * 后台定位预留入口。
 * Phase 2：在此定义 TaskManager 任务，并与 Location.startLocationUpdatesAsync 绑定。
 */
import * as TaskManager from 'expo-task-manager';

import { BACKGROUND_LOCATION_TASK } from './tracker';

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('background location task error', error);
      return;
    }

    // 预留：解析 data.locations 并走与前台相同的上报通道
    console.log('background location task received', data);
  });
}
