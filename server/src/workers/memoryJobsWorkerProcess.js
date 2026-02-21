const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const repoEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(repoEnvPath)) {
    dotenv.config({ path: repoEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, override: true });
}

const { runMemoryJobsWorker } = require('../lib/memoryJobsWorker');
const { isSupabaseConfigured } = require('../lib/supabase');
const { assertMemoryRuntimeConfig } = require('../lib/memoryRuntimeConfig');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let stopRequested = false;

function requestStop(signal) {
    if (stopRequested) {
        return;
    }

    stopRequested = true;
    console.log(`[MemoryWorkerProcess] Received ${signal}. Stopping memory jobs worker...`);
}

process.once('SIGINT', () => requestStop('SIGINT'));
process.once('SIGTERM', () => requestStop('SIGTERM'));

async function run() {
    let runtimeConfig;
    try {
        runtimeConfig = assertMemoryRuntimeConfig({
            env: {
                ...process.env,
                MEMORY_JOBS_WORKER_EXTERNAL: 'true',
            },
            supabaseConfigured: isSupabaseConfigured(),
        });
    } catch (error) {
        console.error('[MemoryWorkerProcess] FATAL: Invalid memory runtime configuration.');
        console.error(`[MemoryWorkerProcess] ${error.message}`);
        process.exit(1);
    }

    console.log(
        `[MemoryWorkerProcess] Starting memory jobs worker (queueOnly=${runtimeConfig.queueOnlyMode}, pollIntervalMs=${runtimeConfig.pollIntervalMs}).`
    );

    while (!stopRequested) {
        try {
            const summary = await runMemoryJobsWorker({
                pollIntervalMs: runtimeConfig.pollIntervalMs,
                once: true,
            });

            if (summary?.emptyPolls > 0 && !stopRequested) {
                await sleep(runtimeConfig.pollIntervalMs);
            }
        } catch (error) {
            console.error('[MemoryWorkerProcess] Worker iteration failed:', error);
            if (!stopRequested) {
                await sleep(runtimeConfig.pollIntervalMs);
            }
        }
    }

    console.log('[MemoryWorkerProcess] Memory jobs worker stopped.');
}

run()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('[MemoryWorkerProcess] FATAL: Worker crashed.', error);
        process.exit(1);
    });
