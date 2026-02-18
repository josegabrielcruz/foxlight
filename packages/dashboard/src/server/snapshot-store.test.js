import { describe, it, expect, beforeEach } from 'vitest';
import { SnapshotStore } from './snapshot-store.js';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function createMockSnapshot(overrides = {}) {
    return {
        id: 'test-snapshot',
        commitSha: 'abc123',
        branch: 'main',
        createdAt: new Date().toISOString(),
        components: [],
        imports: [],
        bundleInfo: [],
        health: [],
        ...overrides,
    };
}
describe('SnapshotStore', () => {
    let testDir;
    beforeEach(async () => {
        testDir = join(tmpdir(), `foxlight-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });
    it('should save and retrieve snapshots', async () => {
        const store = new SnapshotStore(testDir);
        const mockData = createMockSnapshot({
            components: [
                {
                    id: 'src/Button.tsx#Button',
                    name: 'Button',
                    filePath: 'src/Button.tsx',
                    line: 1,
                    framework: 'react',
                    exportKind: 'named',
                    props: [],
                    children: [],
                    usedBy: [],
                    dependencies: [],
                    metadata: {},
                },
            ],
        });
        const timestamp = await store.saveSnapshot(mockData);
        expect(timestamp).toBeTruthy();
        const snapshot = await store.loadLatestSnapshot();
        expect(snapshot).toBeTruthy();
        expect(snapshot?.data.components?.[0]?.name).toBe('Button');
    });
    it('should maintain snapshot history', async () => {
        const store = new SnapshotStore(testDir);
        const mockData1 = createMockSnapshot({
            id: 'snapshot-1',
            components: [
                {
                    id: 'src/A.tsx#A',
                    name: 'A',
                    filePath: 'src/A.tsx',
                    line: 1,
                    framework: 'react',
                    exportKind: 'named',
                    props: [],
                    children: [],
                    usedBy: [],
                    dependencies: [],
                    metadata: {},
                },
            ],
        });
        const mockData2 = createMockSnapshot({
            id: 'snapshot-2',
            components: [
                {
                    id: 'src/B.tsx#B',
                    name: 'B',
                    filePath: 'src/B.tsx',
                    line: 1,
                    framework: 'react',
                    exportKind: 'named',
                    props: [],
                    children: [],
                    usedBy: [],
                    dependencies: [],
                    metadata: {},
                },
            ],
        });
        await store.saveSnapshot(mockData1);
        await store.saveSnapshot(mockData2);
        const snapshots = await store.loadSnapshots();
        expect(snapshots.length).toBeGreaterThanOrEqual(2);
    });
});
//# sourceMappingURL=snapshot-store.test.js.map