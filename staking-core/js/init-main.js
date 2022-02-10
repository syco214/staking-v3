const anchor = require('@project-serum/anchor');
const serumCmn = require("@project-serum/common");
const { TOKEN_PROGRAM_ID, Token } = require("@solana/spl-token");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
const fs = require('fs');

const path = require('path');
const os = require("os");

const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../target/idl/nft_staking.json')));
const programID = new anchor.web3.PublicKey(idl.metadata.address);

const walletKeyData = JSON.parse(fs.readFileSync(os.homedir() + '/.config/solana/id.json'));
const walletKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(walletKeyData));
const wallet = new anchor.Wallet(walletKeypair);

const connection = new anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL);

function getProvider() {
  const provider = new anchor.Provider(
      connection, wallet, { preflightCommitment: "processed" },
  );
  return provider;
};
const provider = getProvider();
let program = new anchor.Program(idl, programID, provider);
let lpMintObject;
let lpTokenPubkey;
let lpMintPubkey = new anchor.web3.PublicKey('TRck3zHXCTyoAsiKPn1NyGb3i1mXFbB8JHheh7uFiVL');
let mintRewards = new anchor.web3.PublicKey('BNTYkJdHkdP9eH4uGouRkqz9RifYL8knHVVVmBMgcNzx');
let poolKeypair, rewardsMintObject;

const initializeMints = async () => {
  console.log("Program ID: ", programID.toString());
  console.log("Wallet: ", provider.wallet.publicKey.toString());

  lpMintObject = new Token(provider.connection, lpMintPubkey, TOKEN_PROGRAM_ID, provider.wallet.payer);
  rewardsMintObject = new Token(provider.connection, mintRewards, TOKEN_PROGRAM_ID, provider.wallet.payer);
  
  const poolRawData = fs.readFileSync('json/pool-main.json');
  poolKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(poolRawData)));

  let tokenAccounts = await provider.connection.getParsedTokenAccountsByOwner(provider.wallet.publicKey, {mint: lpMintPubkey});

  let lpTokenAccountInfo = await lpMintObject.getOrCreateAssociatedAccountInfo(provider.wallet.publicKey);
  lpTokenPubkey = lpTokenAccountInfo.address;
}

const initializePool = async () => {
  await initializeMints();

  const [
        _poolSigner,
        _nonce,
    ] = await anchor.web3.PublicKey.findProgramAddress(
        [poolKeypair.publicKey.toBuffer()],
        programID
    );
    let poolSigner = _poolSigner;
    let poolNonce = _nonce;
    console.log(poolSigner.toBase58())

    let lpTokenPoolVault = await lpMintObject.createAccount(poolSigner);
    let mintRewardsVault = await rewardsMintObject.createAccount(poolSigner);

    const [
        _vaultPubkey,
        _vaultNonce,
    ] = await anchor.web3.PublicKey.findProgramAddress(
        [provider.wallet.publicKey.toBuffer(), poolKeypair.publicKey.toBuffer()],
        programID
    );
    let vaultPubkey = _vaultPubkey;
    let vaultNonce = _vaultNonce;

    await program.rpc.initializePool(
        poolNonce,
        vaultNonce,
        {
            accounts: {
                authority: provider.wallet.publicKey,
                lpTokenPoolVault: lpTokenPoolVault,
                lpTokenDepositor: lpTokenPubkey,
                lpTokenDepositAuthority: provider.wallet.publicKey,
                rewardMint: mintRewards,
                rewardVault: mintRewardsVault,
                poolSigner: poolSigner,
                pool: poolKeypair.publicKey,
                owner: provider.wallet.publicKey,
                vault: vaultPubkey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [poolKeypair],
            instructions: [
                await program.account.pool.createInstruction(poolKeypair, ),
            ],
        }
    );
    console.log("Successfully initialized!");
}

initializePool();