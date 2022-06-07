import React from 'react';
import MetaMaskOnboarding from '@metamask/onboarding';

const POLYGON_MAINNET_PARAMS = {
    chainId: '0x89', // 137
    chainName: 'Polygon Mainnet',
    nativeCurrency: {
        name: 'MATIC Token',
        symbol: 'MATIC',
        decimals: 18
    },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com/']
};

const isPolygonChain = (chainId) => (
    chainId && chainId.toLowerCase() === POLYGON_MAINNET_PARAMS.chainId.toLowerCase()
);

export class OnboardingButton extends React.Component {
    constructor (props) {
        super(props)

        this.state = {
            accounts: [],
            chainId: null,
            onboarding: new MetaMaskOnboarding()
        }

        this.connectMetaMask = this.connectMetaMask.bind(this)
        this.switchToPolygonChain = this.switchToPolygonChain.bind(this)
    }

    componentDidMount () {
        if (MetaMaskOnboarding.isMetaMaskInstalled()) {
            this.connectMetaMask()

            // Update the list of accounts if the user switches accounts in MetaMask
            window.ethereum.on('accountsChanged', accounts => this.setState({ accounts }))

            // Reload the site if the user selects a different chain
            window.ethereum.on('chainChanged', () => window.location.reload())

            // Set the chain id once the MetaMask wallet is connected
            window.ethereum.on('connect', (connectInfo) => {
                console.log('connect', connectInfo);
                const chainId = connectInfo.chainId
                this.setState({ chainId })
                if (isPolygonChain(chainId)) {
                    // The user is now connected to the MetaMask wallet and has the correct
                    // Polygon chain selected.
                    this.props.onConnected()
                }
            })
        }
    }

    connectMetaMask () {
        // Request to connect to the MetaMask wallet
        window.ethereum
            .request({ method: 'eth_requestAccounts' })
            .then(accounts => this.setState({ accounts }))
    }

    switchToPolygonChain () {
        // Request to switch to the selected Polygon network
        window.ethereum
            .request({
                method: 'wallet_addEthereumChain',
                params: [POLYGON_MAINNET_PARAMS]
            })
    }

    render () {
        if (MetaMaskOnboarding.isMetaMaskInstalled()) {
            if (this.state.accounts.length > 0) {
                // If the user is connected to MetaMask, stop the onboarding process.
                this.state.onboarding.stopOnboarding()
                this.props.onConnected();
            }
        }

        if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
            // If MetaMask is not yet installed, ask the user to start the MetaMask onboarding process
            // (install the MetaMask browser extension).
            return (
                <div>
                <div>To run this dApp you need the MetaMask Wallet installed.</div>
                <button onClick={this.state.onboarding.startOnboarding}>
                Install MetaMask
                </button>
                </div>
            )
        } else if (this.state.accounts.length === 0) {
            // If accounts is empty the user is not yet connected to the MetaMask wallet.
            // Ask the user to connect to MetaMask.
            return (
                <div>
                    <div>To run this dApp you need to connect your MetaMask Wallet.</div>
                    <button onClick={this.connectMetaMask}>
                    Connect your Wallet
                    </button>
                </div>
            )
        } else if (this.state.chainId && !isPolygonChain(this.state.chainId)) {
            // If the selected chain id is not the Polygon chain id, ask the user to switch
            // to Polygon.
            return (
                <div>
                    <div>MetaMask Wallet connected!</div>
                    <div>Chain: {this.state.chainId}</div>
                    <div>Account: {this.state.accounts[0]}</div>
                    <div>To run this dApp you need to switch to the {POLYGON_MAINNET_PARAMS.chainName} chain</div>
                    <button onClick={this.switchToPolygonChain}>
                    Switch to the {POLYGON_MAINNET_PARAMS.chainName} chain
                    </button>
                </div>
            )
        }
    }
}
