import { create } from 'zustand';

const useUiStore = create((set) => ({
    dockHiddenCount: 0,
    hideDock: () => set((state) => ({ dockHiddenCount: state.dockHiddenCount + 1 })),
    showDock: () => set((state) => ({ dockHiddenCount: Math.max(0, state.dockHiddenCount - 1) })),
}));

export default useUiStore;
