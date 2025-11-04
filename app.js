// Token addresses on Fantom network
const TOKEN_ADDRESSES = {
    ORBS: '0x43a8cab15d06d3a5fe5854d714c37e7e9246f170',
    USDC: '0x1b6382dbdea11d97f24495c9a90b7c88469134a4',
    WFTM: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
};

const FANTOM_CHAIN_ID = '0xfa'; // 250 in hex

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
sendBtn.addEventListener('click', () => handleAsync(sendTransaction));

// Simplified function selector computation
// For ERC20 and Uniswap V2 functions, we use known selectors
function computeFunctionSelector(signature) {
    const selectors = {
        'balanceOf(address)': '0x70a08231',
        'decimals()': '0x313ce567',
        'approve(address,uint256)': '0x095ea7b3',
        'token0()': '0x0dfe1681',
        'token1()': '0xd21220a7',
        'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)': '0xbaa2abde'
    };
    return selectors[signature] || '0x00000000';
}

// Centralized error handling utility
async function handleAsync(fn) {
    try {
        await fn();
    } catch (error) {
        console.error('Error:', error);
        showStatus(`Error: ${error.message}`, 'error');
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
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: FANTOM_CHAIN_ID }],
        }).catch(async (switchError) => {
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
                        rpcUrls: ['https://rpc.ftm.tools/'],
                        blockExplorerUrls: ['https://ftmscan.com/']
                    }]
                });
            } else {
                throw switchError;
            }
        });
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
    const balanceSelector = computeFunctionSelector('balanceOf(address)');
    const decimalsSelector = computeFunctionSelector('decimals()');
    
    const balanceData = balanceSelector + padAddress(userAccount);
    const decimalsData = decimalsSelector;

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
    const approveSelector = computeFunctionSelector('approve(address,uint256)');
    const data = approveSelector + padAddress(routerAddress) + padUint256(maxAmount);

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

async function sendTransaction() {
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

    showStatus('Reading LP token info...', 'info');

    // Get token0 and token1 from LP address
    const token0Selector = computeFunctionSelector('token0()');
    const token1Selector = computeFunctionSelector('token1()');

    const [token0Result, token1Result] = await Promise.all([
        web3.request({
            method: 'eth_call',
            params: [{
                to: lpAddress,
                data: token0Selector
            }, 'latest']
        }),
        web3.request({
            method: 'eth_call',
            params: [{
                to: lpAddress,
                data: token1Selector
            }, 'latest']
        })
    ]);

    // Extract addresses from results (last 40 hex chars)
    const token0 = '0x' + token0Result.slice(-40);
    const token1 = '0x' + token1Result.slice(-40);

    showStatus('Sending removeLiquidity transaction...', 'info');

    // removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline)
    const removeLiquiditySelector = computeFunctionSelector('removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)');
    
    // Hardcoded parameters for now (these should be calculated properly in production)
    const liquidity = '0x0000000000000000000000000000000000000000000000000000000000000000'; // 0 for now
    const amountAMin = '0x0000000000000000000000000000000000000000000000000000000000000000'; // 0
    const amountBMin = '0x0000000000000000000000000000000000000000000000000000000000000000'; // 0
    const deadline = '0x' + (Math.floor(Date.now() / 1000) + 3600).toString(16).padStart(64, '0'); // 1 hour from now

    const data = removeLiquiditySelector +
                 padAddress(token0) +
                 padAddress(token1) +
                 liquidity +
                 amountAMin +
                 amountBMin +
                 padAddress(userAccount) +
                 deadline;

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
