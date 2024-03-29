import React, { useEffect, useCallback, useState } from 'react';
import { isMobile } from 'react-device-detect';
import * as anchor from "@project-serum/anchor";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    PublicKey,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY
} from '@solana/web3.js';
import { FaBars } from 'react-icons/fa';

import { ReactComponent as GlobeIcon } from './Globe.svg';

import * as borsh from 'borsh';

import {
    Container,
    Row,
    Col,
    Card,
    CardImg,
    Button,
    Badge
} from 'reactstrap';
import axios from 'axios';
import {
    getParsedNftAccountsByOwner,
    isValidSolanaAddress,
} from "@nfteyez/sol-rayz";

import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { getOrCreateAssociatedTokenAccount } from './libs/getOrCreateAssociatedTokenAccount'
import { createTokenAccount } from './libs/createTokenAccount'

import { METADATA_SCHEMA, Metadata } from "./types.ts";
import idl from './assets/nft_staking.json'
import nfts from './assets/MINT_LIST_1.json';

import {
    WalletModalProvider,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import {
    poolPublicKey,
    mintRewardsPublicKey,
    lpMintPublicKey,
    funderPublicKey,
    programId
} from "./config";
import { getPoolSigner, getStakeUserPubkey, getStakeUserStorePubkey, getVaultPubkey } from './utils';

const opts = {
    preflightCommitment: "processed"
}

const Home = () => {

    const [nftData, setNftData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState(null);
    const [program, setProgram] = useState(null);
    const [pendingRewards, setPendingRewards] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [stakedNfts, setStakedNfts] = useState(0);
    const [totalStaked, setTotalStaked] = useState(0);
    const [dailyRewards, setDailyRewards] = useState(0);

    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    const wallet = useWallet();

    async function getProvider() {
        const provider = new anchor.Provider(
            connection, wallet, opts.preflightCommitment,
        );
        return provider;
    }

    const getAllNftData = async (walletPubKey) => {
        try {
            const nfts = await getParsedNftAccountsByOwner({
                publicAddress: walletPubKey,
                connection: connection,
                serialization: true,
            });

            return nfts;
        } catch (error) {
            console.log(error);
        }
    };

    const getStakedNFTs = async () => {
        let [poolSigner] = await getPoolSigner();
        const nfts = await getParsedNftAccountsByOwner({
            publicAddress: poolSigner,
            connection: connection,
            serialization: true,
        });
        console.log(nfts)

        try {
            var stakedNfts = [];

            const [userPubkey] = await getStakeUserPubkey(provider.wallet.publicKey);

            const userObject = await program.account.user.fetch(userPubkey);
            for (let i = 0; i < userObject.stores; i++) {
                const [storePubkey] = await getStakeUserStorePubkey(provider.wallet.publicKey, i + 1);
                const storeObject = await program.account.userStore.fetch(storePubkey);
                for (let j = 0; j < storeObject.nftMints.length; j++) {
                    var mDataKey = await getMetadata(storeObject.nftMints[j]);

                    const metadataObj = await provider.connection.getAccountInfo(
                        mDataKey,
                    );
                    const metadataDecoded = decodeMetadata(
                        Buffer.from(metadataObj.data),
                    );

                    metadataDecoded['staked'] = true;
                    metadataDecoded['mint'] = storeObject.nftMints[j].toBase58();
                    metadataDecoded['storeId'] = storeObject.storeId;

                    stakedNfts.push(metadataDecoded);
                }
            }

            setStakedNfts(stakedNfts.length);

            return stakedNfts;
        } catch (err) {
            console.log(err)
            return []
        }

    }

    const getPendingRewardsFunc = async () => {
        const [userPubkey] = await getStakeUserPubkey(provider.wallet.publicKey);

        let poolObject = await program.account.pool.fetch(poolPublicKey);
        try {
            const userObject = await program.account.user.fetch(userPubkey);
            var now = parseInt((new Date()).getTime() / 1000)
            var a = 0;
            var dd = 0;
            for (let i = 0; i < userObject.stores; i++) {
                const [storePubkey] = await getStakeUserStorePubkey(provider.wallet.publicKey, i + 1);
                const storeObject = await program.account.userStore.fetch(storePubkey);
                for (let j = 0; j < storeObject.nftMints.length; j++) {
                    let diffDays = now - storeObject.stakedTimes[j].toNumber();
                    const d = poolObject.rewardPerToken.toNumber() / storeObject.types[j];
                    a += d * parseInt(diffDays / (24 * 60 * 60));
                    dd += d;
                }
                a += storeObject.rewardTokenPending.toNumber();
            }
            setDailyRewards((dd / anchor.web3.LAMPORTS_PER_SOL).toFixed(1));
            setPendingRewards((a / anchor.web3.LAMPORTS_PER_SOL).toFixed(1));
        } catch (err) {
            console.error(err.message);
            console.log("There is no staked NFTs");
        }
    }

    const setNftTokenData = async (walletPubKey) => {
        try {
            var nftsubData = [];
            nftsubData = await getAllNftData(walletPubKey);
            var data = Object.keys(nftsubData).map((key) => nftsubData[key]);
            let arr = [];

            var stakedNFTs = await getStakedNFTs();
            console.log(stakedNFTs)
            for (let i = 0; i < stakedNFTs.length; i++) {
                data.push(stakedNFTs[i]);
            }

            let n = data.length;
            // let n = 10;
            for (let i = 0; i < n; i++) {
                if (nfts.indexOf(data[i].mint) === -1) {
                    continue;
                }
                var val = {};
                try {
                    val = await axios.get(data[i].data.uri);
                } catch (err) {
                    val = {
                        data: {
                            name: "",
                            count: 0,
                            image: "",
                        }
                    }
                }
                if (data[i].staked !== true) data[i].staked = false;
                val.mint = data[i].mint;
                val.staked = data[i].staked;
                val.creator = data[i].data.creators[0].address;
                val.creators = data[i].data.creators;
                val.storeId = data[i].storeId;
                arr.push(val);
            }

            setNftData(arr)
        } catch (error) {
            console.log(error);
        }
    };

    const initialize = async () => {

        var cProvider = await getProvider();
        setProvider(cProvider)
        var cProgram = new anchor.Program(idl, programId, cProvider);
        setProgram(cProgram);

    }

    const stakeNFT = async (metaNFT) => {
        const [vaultPublicKey] = await getVaultPubkey();

        const vaultObject = await program.account.vault.fetch(vaultPublicKey);
        const nftCreator = vaultObject.candyMachines.find((cm) => cm.toBase58() === metaNFT.creator);

        if (!nftCreator) {
            alert("No match candy machine. Pool has not candymachine id. " + metaNFT.creator);
            return;
        }

        const poolObject = await program.account.pool.fetch(poolPublicKey);

        var mintPubKey = new PublicKey(metaNFT.mint);

        const walletPubkey = provider.wallet.publicKey;
        const [
            userPubkey,
            userNonce
        ] = await getStakeUserPubkey(walletPubkey);

        let instructions = [];
        var accountFalg = false;
        var userObject;
        try {
            userObject = await program.account.user.fetch(userPubkey);
            accountFalg = true;
        } catch (err) {
            console.log(err)
        }

        const [_storePubkey, _storeNonce] = await getStakeUserStorePubkey(walletPubkey, 1);
        let storePubkey = _storePubkey;
        let storeNonce = _storeNonce;
        if (accountFalg === false) {
            console.log("Create User Staking Account");
            instructions.push(await program.instruction.createUser(userNonce, storeNonce, {
                accounts: {
                    pool: poolPublicKey,
                    user: userPubkey,
                    userStore: storePubkey,
                    owner: walletPubkey,
                    systemProgram: SystemProgram.programId,
                },
            }));
        } else {
            const [_storePubkey, _storeNonce] = await getStakeUserStorePubkey(walletPubkey, userObject.stores);
            storePubkey = _storePubkey;
            storeNonce = _storeNonce;
            const userStoreObject = await program.account.userStore.fetch(storePubkey);
            if (userStoreObject.nftMints.length >= 300) {
                const [newStorePubkey, newStoreNonce] = await getStakeUserStorePubkey(walletPubkey, userObject.stores + 1);
                storePubkey = newStorePubkey;
                storeNonce = newStoreNonce;
                instructions.push(await program.instruction.createUserStore(newStoreNonce, {
                    accounts: {
                        pool: poolPublicKey,
                        user: userPubkey,
                        userStore: newStorePubkey,
                        owner: walletPubkey,
                        systemProgram: SystemProgram.programId,
                    },
                }));
            }

        }
        console.log("Stake NFT");
        const nftMint = new Token(provider.connection, mintPubKey, TOKEN_PROGRAM_ID, provider.wallet.payer);

        const nftOwnerAccounts = await provider.connection.getTokenAccountsByOwner(walletPubkey, { mint: nftMint.publicKey });
        let nftAccount;
        if (nftOwnerAccounts.value.length == 0) {
            alert("This nft is not your nft.");
            return;
        }
        else {
            nftAccount = nftOwnerAccounts.value[0].pubkey;
            const nftBalance = await provider.connection.getTokenAccountBalance(nftAccount);
            if (nftBalance.value.uiAmount === 0) {
                alert("This nft is not your nft.");
            }
        }

        console.log("1----------------")
        let metadata = await getMetadata(nftMint.publicKey);
        console.log("2----------------")
        const [poolSigner] = await getPoolSigner();

        const lpPoolAccount = poolObject.lpTokenPoolVault;
        console.log("3----------------")
        let lpUserAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            walletPubkey,
            lpMintPublicKey,
            walletPubkey,
            signTransaction
        );
        console.log("4----------------")
        const nftAccounts = await provider.connection.getTokenAccountsByOwner(poolSigner, { mint: nftMint.publicKey });
        let toTokenAccount;
        if (nftAccounts.value.length == 0) {
            try {
                console.log("5----------------")
                let toTokenAccountObject = await createTokenAccount(
                    provider.connection,
                    walletPubkey,
                    nftMint.publicKey,
                    poolSigner,
                    signTransaction
                );
                console.log("6----------------")
                toTokenAccount = toTokenAccountObject.address;
            } catch (error) {
                if (error.message === 'TokenAccountNotFoundError' || error.message === 'TokenInvalidAccountOwnerError') {
                    alert("Need to create stake account.");
                    return;
                }
            }
        }
        else {
            toTokenAccount = nftAccounts.value[0].pubkey;
        }

        try {
            instructions.push(await program.instruction.stake(
                {
                    accounts: {
                        // Stake instance.
                        pool: poolPublicKey,
                        vault: vaultPublicKey,
                        stakeToAccount: toTokenAccount,
                        lpTokenPoolVault: lpPoolAccount,
                        lpTokenReceiver: lpUserAccount.address,
                        // User.
                        user: userPubkey,
                        userStore: storePubkey,
                        owner: walletPubkey,
                        stakeFromAccount: nftAccount,
                        // Program signers.
                        poolSigner,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        metadataInfo: metadata
                    },
                }
            ))
            await confirmTransaction(instructions)
            console.log("Success!");
            getPendingRewardsFunc();
            setLoading(false);
            await setNftTokenData(walletPubkey);
            setLoading(true);
        } catch (err) {
            alert("Something went wrong! Please try again.");
        }
    }

    const claimRewards = async () => {

        var accountFalg = false;
        const [storePubkey] = await getStakeUserStorePubkey(provider.wallet.publicKey, 1);

        try {
            const storeObject = await program.account.userStore.fetch(storePubkey);

            if (storeObject.nftMints.length > 0) {
                accountFalg = true;
            }
        } catch (err) { }

        const [vaultPublicKey] = await getVaultPubkey();

        if (accountFalg === true) {
            var claimeAmount = await claimRewardsCore(vaultPublicKey);
            console.log(claimeAmount);
        } else {
            console.log("There is no staked NFTs");
        }
    }

    const claimRewardsCore = async (vault) => {
        const [userPubkey] = await getStakeUserPubkey(provider.wallet.publicKey);
        let poolObject = await program.account.pool.fetch(poolPublicKey);
        let rewardAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.publicKey,
            mintRewardsPublicKey,
            wallet.publicKey,
            signTransaction
        );

        const [poolSigner] = await getPoolSigner();
        const userObject = await program.account.user.fetch(userPubkey);
        let instructions = [];
        for (var i = 0; i < userObject.stores; i++) {
            const [storePubkey] = await getStakeUserStorePubkey(provider.wallet.publicKey, i + 1);
            instructions.push(await program.instruction.claim({
                accounts: {
                    // Stake instance.
                    pool: poolPublicKey,
                    vault,
                    rewardVault: poolObject.rewardVault,
                    // User.
                    user: userPubkey,
                    userStore: storePubkey,
                    owner: provider.wallet.publicKey,
                    rewardAccount: rewardAccount.address,
                    // Program signers.
                    poolSigner,
                    // Misc.
                    clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }))
        }

        try {
            await confirmTransaction(instructions);

            let amt = await this.provider.connection.getTokenAccountBalance(rewardAccount.address);

            return amt.value.uiAmount;
        } catch (err) {
            return 0;
        }
    }

    const unStakeNFT = async (mintObj) => {
        let poolObject = await program.account.pool.fetch(poolPublicKey);
        var mintPubKey = new PublicKey(mintObj.mint);

        const nftMint = new Token(provider.connection, mintPubKey, TOKEN_PROGRAM_ID, provider.wallet.payer);

        const lpPoolAccount = poolObject.lpTokenPoolVault;

        const lpMint = new Token(provider.connection, lpMintPublicKey, TOKEN_PROGRAM_ID, provider.wallet.payer);
        const lpUserAccounts = await connection.getTokenAccountsByOwner(provider.wallet.publicKey, { mint: lpMintPublicKey });
        let lpUserAccount;
        if (lpUserAccounts.value.length == 0) {
            lpUserAccount = await lpMint.createAssociatedTokenAccount(provider.wallet.publicKey);
        }
        else {
            lpUserAccount = lpUserAccounts.value[0].pubkey;
        }

        let metadata = await getMetadata(nftMint.publicKey);

        const [vaultPublicKey] = await getVaultPubkey();
        const [poolSigner] = await getPoolSigner();

        let nftAccounts = await connection.getTokenAccountsByOwner(poolSigner, {
            mint: mintPubKey
        })
        let nftAccount = nftAccounts.value[0].pubkey;

        const toTokenAccounts = await connection.getTokenAccountsByOwner(provider.wallet.publicKey, { mint: mintPubKey });
        let toTokenAccount;
        if (toTokenAccounts.value.length == 0) {
                const toTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                wallet.publicKey,
                mintPubKey,
                wallet.publicKey,
                signTransaction
            );
            toTokenAccount = toTokenAccountInfo.address;
        }
        else {
            toTokenAccount = toTokenAccounts.value[0].pubkey;
        }

        const [userPubkey] = await getStakeUserPubkey(provider.wallet.publicKey);
        const [storePubkey] = await getStakeUserStorePubkey(provider.wallet.publicKey, mintObj.storeId);
        // console.log(mintObj); return;
        try {
            await program.rpc.unstake(
                {
                    accounts: {
                        // Stake instance.
                        pool: poolPublicKey,
                        vault: vaultPublicKey,
                        stakeToAccount: nftAccount,
                        lpTokenPoolVault: lpPoolAccount,
                        lpTokenReceiver: lpUserAccount,
                        // User.
                        user: userPubkey,
                        userStore: storePubkey,
                        owner: provider.wallet.publicKey,
                        stakeFromAccount: toTokenAccount,
                        // Program signers.
                        poolSigner,
                        // Misc.
                        clock: SYSVAR_CLOCK_PUBKEY,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        metadataInfo: metadata
                    },
                });

            console.log("Success!");
            getPendingRewardsFunc();
            setLoading(false);
            await setNftTokenData(provider.wallet.publicKey);
        } catch (e) {
            alert("Something when wrong. Try again");
        }
        setLoading(true);

    }

    const getMetadata = async (mint) => {
        const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
            'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
        );
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from('metadata'),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID,
            )
        )[0];
    };

    const confirmTransaction = async (instructions) => {
        if (instructions.length === 0) {
            return;
        }
        const transaction = new anchor.web3.Transaction().add(...instructions);
        const blockHash = await provider.connection.getRecentBlockhash()
        transaction.feePayer = await provider.wallet.publicKey
        transaction.recentBlockhash = await blockHash.blockhash
        const signed = await signTransaction(transaction)

        const signature = await provider.connection.sendRawTransaction(signed.serialize())

        await provider.connection.confirmTransaction(signature)
    }

    const decodeMetadata = (buffer) => {
        return borsh.deserializeUnchecked(METADATA_SCHEMA, Metadata, buffer);
    }

    useEffect(() => {
        if (publicKey) {
            initialize()
        }
    }, [publicKey])

    useEffect(async () => {
        if (program) {
            await setNftTokenData(provider.wallet.publicKey);
            setLoading(true);
            getPendingRewardsFunc();
        }
    }, [program])

    useEffect(async () => {
        if (program) {
            const poolObject = await program.account.pool.fetch(poolPublicKey);
            setTotalStaked(poolObject.balanceStaked.toNumber());
        }
    }, [stakedNfts])

    return (
        <div className="main">
            <Row style={{ margin: 0 }}>
                <div className="App-header">
                    The previous staking program has been closed, your staked NFTs have been returned to your wallets. Please refer to the links below and open a ticket in our discord for any issues.
                </div>
                <a className="App-header2" href="https://staking.bountyhunterspaceguild.com/">
                    STAKE BOUNTY HUNTERS HERE.
                </a>
                <a className="App-header2" href="https://forms.gle/7hQEHeb9jdUWYY7g7">
                    Claim Pending BNTY Here
                </a>
            </Row>
        </div>
    );
};

export default Home;