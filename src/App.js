import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import { ethers } from 'ethers';
import { OnboardingButton } from './Onboarding.js';
import GameABI from './game_abi.js';
import sortBy from 'sort-by';
import './App.css';

const GAME_ADDRESS = '0x9d0c114Ac1C3cD1276B0366160B3354ca0f9377E';

const slice = createSlice({
    name: 'data-runs',
    initialState: {
        connected: false,
        address: null,
        gameContract: null,
        runs: [],
        runDB: {},
        runnerDB: {},
    },
    reducers: {
        connected: (state, action) => {
            state.connected = true;
            state.address = action.payload.address;
            state.gameContract = action.payload.gameContract;
            state.onConnect = true;
        },
        connectFinished: (state, action) => {
            state.onConnect = false;
        },
        gotRuns: (state, action) => {
            state.runs = action.payload.runs;
        },
        storeRunData: (state, action) => {
            state.runDB[action.payload.runId] = action.payload.runData;
        },
        storeRunnerData: (state, action) => {
            state.runnerDB[action.payload.runnerId] = action.payload.runner;
        },
    },
});

const {
    connected, connectFinished,
    gotRuns, storeRunData, storeRunnerData,
} = slice.actions;
const store = configureStore({
    reducer: slice.reducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActionPaths: [
                    'payload.gameContract',
                    'payload.runs',
                ],
                ignoredPaths: [
                    'gameContract',
                    'runs',
                ],
            },
        }),
});

const selectAddress = state => state.address;
const selectRuns = state => state.runs;

async function fetchRunData(runId) {
    const { runDB, gameContract } = store.getState();
    if (runDB[runId]) {
        return runDB[runId];
    } else if (gameContract) {
        return gameContract.runsById(runId).then(r => {
            return {
                notorietyPoints: r.notorietyPoints?.toNumber(),
                data: parseInt(ethers.utils.formatUnits(r.data, 18)),
                startTime: r.startTime?.toNumber(),
                endTime: r.endTime?.toNumber(),
            };
        }).then(runData => {
            store.dispatch(storeRunData({ runId, runData }));
            return runData;
        });
    }
}

async function fetchRunnerData(runnerId) {
    const { runnerDB } = store.getState();
    if (runnerDB[runnerId]) {
        return runnerDB[runnerId];
    } else {
        return fetch(`https://2112-api.sirsean.workers.dev/runner/${runnerId}`)
            .then(r => r.json())
            .then(runner => {
                store.dispatch(storeRunnerData({ runnerId, runner }));
                return runner;
            })
            .catch(e => {
                // ephemeral CORS errors?
                return null;
            });
    }
}

async function augmentRun(run) {
    const runId = run.runId;

    const [ runData, runner ] = await Promise.all([
        fetchRunData(runId),
        fetchRunnerData(run.tokenId.toNumber()),
    ]);
    return Object.assign({}, run, { runData }, { runner });
}

async function fetchRuns() {
    const { gameContract } = store.getState();
    if (gameContract) {
        return gameContract.provider.getBlock().then(block => {
            // max 10k blocks per request
            return gameContract.queryFilter(gameContract.filters.RunEnded(), block.number - 10000, block.number);
        })
            .then(all => all.map(e => e.args))
            .then(runs => Promise.all(runs.map(augmentRun)))
            .then(runs => runs.sort(sortBy('-runData.endTime')))
            .then(runs => {
                store.dispatch(gotRuns({ runs }));
            });
    }
}

store.subscribe(() => {
    const { onConnect } = store.getState();
    if (onConnect) {
        store.dispatch(connectFinished());
        fetchRuns();
    }
});

const onConnected = async () => {
    console.log('onConnected');
    // Use the MetaMask wallet as ethers provider
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const address = await provider.listAccounts().then(accounts => accounts[0]);

    const gameContract = new ethers.Contract(
        GAME_ADDRESS,
        GameABI,
        provider
    );

    store.dispatch(connected({gameContract, address}));
}

setInterval(async () => {
    await fetchRuns();
}, 10000);

function RunTitle() {
    return (
        <div className="RunTitle">
            <div className="row">
                <div className="col">Runner</div>
                <div className="col">Notoriety</div>
                <div className="col">DATA</div>
                <div className="col">At</div>
                <div className="col run-link"></div>
            </div>
        </div>
    );
}

function RunRow({ run }) {
    const runnerId = run.tokenId.toNumber();
    const runnerHref = `https://runner-hunter.sirsean.workers.dev/${runnerId}`;
    const runHref = `https://runner-hunter.sirsean.workers.dev/run/${run.runId}`;
    return (
        <div className="RunRow">
            <div className="row">
                <div className="col">
                    <div className="imgWrapper">
                        {run?.runner?.image &&
                            <a href={runnerHref} target="_blank" rel="noreferrer">
                                <img className="runner" src={run.runner.image} alt={runnerId} />
                            </a>}
                        <span className="runner-id">{runnerId}</span>
                    </div>
                </div>
                <div className="col np">{run.runData.notorietyPoints}</div>
                <div className="col data">{run.runData.data}</div>
                <div className="col">{(new Date(run.runData.endTime * 1000)).toLocaleString()}</div>
                <div className="col run-link"><a href={runHref} target="_blank" rel="noreferrer">View Run</a></div>
            </div>
        </div>
    );
}

function RunList() {
    const runs = useSelector(selectRuns);
    return (
        <div className="RunList">
            <RunTitle />
            {runs.map(run => {
                return <RunRow key={run.runId} run={run} />
            })}
        </div>
    );
}

function Main() {
    return (
        <div className="Main">
            <OnboardingButton onConnected={onConnected} />
            <RunList />
        </div>
    );
}

function Header() {
    const address = useSelector(selectAddress);
    return (
        <header>
            <div className="left"><h1>data-runs</h1></div>
            <div className="right">
                <span>{address}</span>
            </div>
        </header>
    );
}

function App() {
    return (
        <Provider store={store}>
            <div className="App">
                <Header />
                <Main />
            </div>
        </Provider>
    );
}

export default App;
