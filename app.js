// Token addresses on Fantom network
const TOKEN_ADDRESSES = {
    ORBS: '0x3E01B7E242D5AF8064cB9A8F9468aC0f8683617c',
    axlUSDC: '0x1B6382DBDEa11d97f24495C9A90b7c88469134a4',
    WFTM: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
};

const FANTOM_CHAIN_ID = '0xfa'; // 250 in hex
const FANTOM_RPC = 'https://rpc.ftm.tools/';

// ERC20 ABI for balanceOf and approve
const ERC20_ABI = [
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            { name: '_spender', type: 'address' },
            { name: '_value', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
    }
];

let web3;
let userAccount;

// DOM elements
const connectBtn = document.getElementById('connectBtn');
const approveBtn = document.getElementById('approveBtn');
const sendBtn = document.getElementById('sendBtn');
const walletAddress = document.getElementById('walletAddress');
const balancesSection = document.getElementById('balancesSection');
const inputsSection = document.getElementById('inputsSection');
const actionsSection = document.getElementById('actionsSection');
const statusDiv = document.getElementById('status');
const lpAddressInput = document.getElementById('lpAddress');
const routerAddressInput = document.getElementById('routerAddress');

// Initialize
connectBtn.addEventListener('click', connectWallet);
approveBtn.addEventListener('click', approveToken);
sendBtn.addEventListener('click', sendTransaction);

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('MetaMask is not installed. Please install MetaMask to continue.', 'error');
            return;
        }

        showStatus('Connecting to MetaMask...', 'info');

        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });

        userAccount = accounts[0];

        // Check if on Fantom network
        const chainId = await window.ethereum.request({ 
            method: 'eth_chainId' 
        });

        if (chainId !== FANTOM_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: FANTOM_CHAIN_ID }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: FANTOM_CHAIN_ID,
                            chainName: 'Fantom Opera',
                            nativeCurrency: {
                                name: 'Fantom',
                                symbol: 'FTM',
                                decimals: 18
                            },
                            rpcUrls: [FANTOM_RPC],
                            blockExplorerUrls: ['https://ftmscan.com/']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }

        web3 = window.ethereum;

        // Update UI
        connectBtn.textContent = 'Connected ✓';
        connectBtn.disabled = true;
        connectBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        
        walletAddress.textContent = `Connected: ${userAccount.substring(0, 6)}...${userAccount.substring(38)}`;
        walletAddress.style.display = 'block';

        balancesSection.style.display = 'block';
        inputsSection.style.display = 'block';
        actionsSection.style.display = 'grid';

        showStatus('Successfully connected to MetaMask!', 'success');
        
        // Load balances
        await loadBalances();

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

async function loadBalances() {
    try {
        // Get native FTM balance
        const ftmBalance = await web3.request({
            method: 'eth_getBalance',
            params: [userAccount, 'latest']
        });
        const ftmFormatted = (parseInt(ftmBalance, 16) / 1e18).toFixed(4);
        document.getElementById('ftmBalance').textContent = ftmFormatted;

        // Get ERC20 balances
        await getTokenBalance('ORBS', TOKEN_ADDRESSES.ORBS, 'orbsBalance');
        await getTokenBalance('axlUSDC', TOKEN_ADDRESSES.axlUSDC, 'axlusdcBalance');
        await getTokenBalance('WFTM', TOKEN_ADDRESSES.WFTM, 'wftmBalance');

    } catch (error) {
        console.error('Error loading balances:', error);
        showStatus('Error loading balances', 'error');
    }
}

async function getTokenBalance(tokenName, tokenAddress, elementId) {
    try {
        // Encode balanceOf function call
        const balanceData = '0x70a08231' + // balanceOf function selector
                            '000000000000000000000000' + userAccount.substring(2);

        const balance = await web3.request({
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: balanceData
            }, 'latest']
        });

        // Fetch decimals dynamically
        const decimalsData = '0x313ce567'; // decimals function selector
        const decimalsResult = await web3.request({
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: decimalsData
            }, 'latest']
        });

        const decimals = parseInt(decimalsResult, 16);
        const balanceFormatted = (parseInt(balance, 16) / Math.pow(10, decimals)).toFixed(4);
        
        document.getElementById(elementId).textContent = balanceFormatted;
    } catch (error) {
        console.error(`Error getting ${tokenName} balance:`, error);
        document.getElementById(elementId).textContent = 'Error';
    }
}

async function approveToken() {
    try {
        const lpAddress = lpAddressInput.value.trim();
        const routerAddress = routerAddressInput.value.trim();

        if (!lpAddress || !routerAddress) {
            showStatus('Please enter both LP token and router addresses', 'error');
            return;
        }

        if (!lpAddress.startsWith('0x') || lpAddress.length !== 42) {
            showStatus('Invalid LP token address', 'error');
            return;
        }

        if (!routerAddress.startsWith('0x') || routerAddress.length !== 42) {
            showStatus('Invalid router address', 'error');
            return;
        }

        showStatus('Requesting approval...', 'info');

        // Approve maximum amount (common DeFi pattern to avoid multiple approval transactions)
        // Note: Users should only approve trusted contracts
        const maxAmount = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        
        // Encode approve function call
        const data = '0x095ea7b3' + // approve function selector
                     routerAddress.substring(2).padStart(64, '0') +
                     maxAmount.substring(2);

        const txHash = await web3.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAccount,
                to: lpAddress,
                data: data
            }]
        });

        showStatus(`Approval submitted! Tx: ${txHash.substring(0, 10)}...`, 'success');
        
        // Reload balances after a short delay (simple approach for better UX)
        setTimeout(loadBalances, 3000);

    } catch (error) {
        console.error('Error approving token:', error);
        showStatus(`Approval failed: ${error.message}`, 'error');
    }
}

async function sendTransaction() {
    try {
        const routerAddress = routerAddressInput.value.trim();

        if (!routerAddress) {
            showStatus('Please enter router address', 'error');
            return;
        }

        if (!routerAddress.startsWith('0x') || routerAddress.length !== 42) {
            showStatus('Invalid router address', 'error');
            return;
        }

        showStatus('Sending transaction...', 'info');

        // Placeholder transaction - actual implementation will be added later
        // Currently sends an empty transaction to the router address
        const txHash = await web3.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAccount,
                to: routerAddress,
                data: '0x', // Placeholder - will be implemented later
                value: '0x0'
            }]
        });

        showStatus(`Transaction sent! Tx: ${txHash.substring(0, 10)}...`, 'success');
        
        // Reload balances after a short delay (simple approach for better UX)
        setTimeout(loadBalances, 3000);

    } catch (error) {
        console.error('Error sending transaction:', error);
        showStatus(`Transaction failed: ${error.message}`, 'error');
    }
}

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Handle account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            // User disconnected wallet
            location.reload();
        } else if (accounts[0] !== userAccount) {
            // User switched accounts
            location.reload();
        }
    });

    window.ethereum.on('chainChanged', () => {
        // Reload on chain change
        location.reload();
    });
}
