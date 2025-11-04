// Token addresses on Fantom network
const TOKEN_ADDRESSES = {
    ORBS: '0x43a8cab15d06d3a5fe5854d714c37e7e9246f170',
    USDC: '0x1b6382dbdea11d97f24495c9a90b7c88469134a4',
    WFTM: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
};

const FANTOM_CHAIN_ID = '0xfa'; // 250 in hex

// Function selectors as constants
const SELECTORS = {
    BALANCE_OF: '0x70a08231',
    DECIMALS: '0x313ce567',
    APPROVE: '0x095ea7b3',
    TOKEN0: '0x0dfe1681',
    TOKEN1: '0xd21220a7',
    REMOVE_LIQUIDITY: '0xbaa2abde'
};

// Constants for transaction parameters
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const ZERO = '0x0';

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
connectBtn.addEventListener('click', () => handleAsync(connectWallet));
approveBtn.addEventListener('click', () => handleAsync(approveToken));
sendBtn.addEventListener('click', () => handleAsync(removeLiquidity));

// Centralized error handling utility
async function handleAsync(fn) {
    try {
        await fn();
    } catch (error) {
        console.error('Error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Validation utility
function validateAddress(address, fieldName) {
    if (!address) {
        throw new Error(`Please enter ${fieldName}`);
    }
    if (!address.startsWith('0x') || address.length !== 42) {
        throw new Error(`Invalid ${fieldName}`);
    }
}

// Utility to pad address for ABI encoding
function padAddress(address) {
    return address.substring(2).padStart(64, '0');
}

// Utility to pad uint256 for ABI encoding
function padUint256(value) {
    return value.substring(2).padStart(64, '0');
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
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
        throw new Error('Please switch to Fantom Opera network in MetaMask');
    }

    web3 = window.ethereum;

    // Update UI
    connectBtn.textContent = 'Connected ✓';
    connectBtn.disabled = true;
    connectBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    
    walletAddress.textContent = `Connected: ${userAccount}`;
    walletAddress.style.display = 'block';

    balancesSection.style.display = 'block';
    inputsSection.style.display = 'block';
    actionsSection.style.display = 'grid';

    showStatus('Successfully connected to MetaMask!', 'success');
    
    // Load balances
    await loadBalances();
}

async function loadBalances() {
    // Fetch all balances in parallel
    const [ftmBalance, orbsBalance, usdcBalance, wftmBalance] = await Promise.all([
        web3.request({
            method: 'eth_getBalance',
            params: [userAccount, 'latest']
        }),
        getTokenBalance(TOKEN_ADDRESSES.ORBS),
        getTokenBalance(TOKEN_ADDRESSES.USDC),
        getTokenBalance(TOKEN_ADDRESSES.WFTM)
    ]);

    // Format and display FTM balance
    const ftmFormatted = (parseInt(ftmBalance, 16) / 1e18).toFixed(4);
    document.getElementById('ftmBalance').textContent = ftmFormatted;

    // Display token balances
    document.getElementById('orbsBalance').textContent = orbsBalance;
    document.getElementById('usdcBalance').textContent = usdcBalance;
    document.getElementById('wftmBalance').textContent = wftmBalance;
}

async function getTokenBalance(tokenAddress) {
    // Fetch balance and decimals in parallel
    const balanceData = SELECTORS.BALANCE_OF + padAddress(userAccount);
    const decimalsData = SELECTORS.DECIMALS;

    const [balance, decimalsResult] = await Promise.all([
        web3.request({
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: balanceData
            }, 'latest']
        }),
        web3.request({
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: decimalsData
            }, 'latest']
        })
    ]);

    const decimals = parseInt(decimalsResult, 16);
    const balanceFormatted = (parseInt(balance, 16) / Math.pow(10, decimals)).toFixed(4);
    
    return balanceFormatted;
}

async function approveToken() {
    const lpAddress = lpAddressInput.value.trim();
    const routerAddress = routerAddressInput.value.trim();

    validateAddress(lpAddress, 'LP token address');
    validateAddress(routerAddress, 'router address');

    showStatus('Requesting approval...', 'info');

    // Approve maximum amount (common DeFi pattern to avoid multiple approval transactions)
    // Note: Users should only approve trusted contracts
    
    // Encode approve function call
    const data = SELECTORS.APPROVE + padAddress(routerAddress) + padUint256(MAX_UINT256);

    const txHash = await web3.request({
        method: 'eth_sendTransaction',
        params: [{
            from: userAccount,
            to: lpAddress,
            data: data
        }]
    });

    showStatus(`Approval submitted! Tx: ${txHash}`, 'success');
    
    // Reload balances after a short delay (simple approach for better UX)
    setTimeout(() => handleAsync(loadBalances), 3000);
}

async function removeLiquidity() {
    const lpAddress = lpAddressInput.value.trim();
    const routerAddress = routerAddressInput.value.trim();

    validateAddress(lpAddress, 'LP token address');
    validateAddress(routerAddress, 'router address');

    showStatus('Reading LP token info...', 'info');

    // Get token0, token1, and user's LP balance in parallel
    const [token0Result, token1Result, lpBalanceResult] = await Promise.all([
        web3.request({
            method: 'eth_call',
            params: [{
                to: lpAddress,
                data: SELECTORS.TOKEN0
            }, 'latest']
        }),
        web3.request({
            method: 'eth_call',
            params: [{
                to: lpAddress,
                data: SELECTORS.TOKEN1
            }, 'latest']
        }),
        web3.request({
            method: 'eth_call',
            params: [{
                to: lpAddress,
                data: SELECTORS.BALANCE_OF + padAddress(userAccount)
            }, 'latest']
        })
    ]);

    // Extract addresses from results (last 40 hex chars)
    const token0 = '0x' + token0Result.slice(-40);
    const token1 = '0x' + token1Result.slice(-40);
    const liquidityAmount = '0x' + lpBalanceResult.slice(2);

    showStatus('Sending removeLiquidity transaction...', 'info');

    // removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline)
    const data = SELECTORS.REMOVE_LIQUIDITY +
                 padAddress(token0) +
                 padAddress(token1) +
                 padUint256(liquidityAmount) +
                 padUint256(ZERO) +
                 padUint256(ZERO) +
                 padAddress(userAccount) +
                 padUint256(MAX_UINT256);

    const txHash = await web3.request({
        method: 'eth_sendTransaction',
        params: [{
            from: userAccount,
            to: routerAddress,
            data: data
        }]
    });

    showStatus(`Transaction sent! Tx: ${txHash}`, 'success');
    
    // Reload balances after a short delay (simple approach for better UX)
    setTimeout(() => handleAsync(loadBalances), 3000);
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
