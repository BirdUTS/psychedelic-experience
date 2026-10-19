/* Bounded actions for a classified request (from JEV or a local phrase). Pure: returns what the app should do.
   A request never removes a lock the user set; it can only report that the lock is in the way. */
export function requestActions(action, { sceneLocked = false, symmetry = 0 } = {}) {
  switch (action) {
    case 'slower': return [{ type: 'slider', id: 'speed', value: 0.45 }];
    case 'faster': return [{ type: 'slider', id: 'speed', value: 1.5 }];
    case 'warmer': return [{ type: 'slider', id: 'hue', value: 20 }];
    case 'cooler': return [{ type: 'slider', id: 'hue', value: 200 }];
    case 'surround': return [{ type: 'camera', value: 'inside' }];
    case 'calm_down': return [{ type: 'slider', id: 'intensity', value: 0.4 }];
    case 'hold_scene': return sceneLocked ? [] : [{ type: 'lockScene', value: true }];
    case 'change_scene': return sceneLocked ? [{ type: 'note', text: 'The scene is locked; unlock it to let the world move on.' }] : [];
    case 'more_symmetry': return [{ type: 'symmetry', value: Math.min(8, symmetry + 2) }];
    case 'less_symmetry': return [{ type: 'symmetry', value: Math.max(0, symmetry - 2) }];
    default: return [];
  }
}
