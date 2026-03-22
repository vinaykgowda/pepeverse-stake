/**
 * Tests for Minimum Stake Duration (Task 15)
 * Requirements: 25.1, 25.2, 25.4
 */

// Set up environment variables before any imports
process.env.HELIUS_API_KEY = 'test-api-key';
process.env.HELIUS_MAINNET_ENDPOINT = 'https://test-helius.com';
process.env.MAINNET_RPC_PRIMARY = 'https://test-rpc.com';

// Mock the database pool before requiring the module
const mockConnection = {
  query: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn()
};

const mockPool = {
  promise: jest.fn(() => ({
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    query: jest.fn()
  }))
};

jest.mock('./db', () => ({
  getPool: jest.fn(() => mockPool)
}));

const { unstakeNFTs, getStakedNFTs } = require('./solana-nft-staking');

describe('Minimum Stake Duration (Task 15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockConnection.query.mockReset();
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();
    mockConnection.release.mockReset();
    
    // Set default implementations
    mockConnection.beginTransaction.mockResolvedValue();
    mockConnection.commit.mockResolvedValue();
    mockConnection.rollback.mockResolvedValue();
    mockConnection.release.mockReturnValue();
    
    // Reset pool mock
    mockPool.promise().getConnection.mockResolvedValue(mockConnection);
    mockPool.promise().query.mockReset();
  });

  describe('Requirement 25.1: Enforce 24-hour minimum stake duration', () => {
    test('should reject unstake if NFT staked less than 24 hours ago', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1];
      
      // NFT staked 12 hours ago (should be rejected)
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      mockConnection.query.mockResolvedValueOnce([
        [{
          id: 1,
          mint_address: 'NFTMint123',
          wallet_address: walletAddress,
          stake_timestamp: twelveHoursAgo,
          unstake_fee: 0.01,
          collection_name: 'Test Collection'
        }]
      ]);
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Minimum stake duration is 24 hours');
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    test('should allow unstake if NFT staked exactly 24 hours ago', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1];
      
      // NFT staked exactly 24 hours ago (should be allowed)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      mockConnection.query
        .mockResolvedValueOnce([
          [{
            id: 1,
            mint_address: 'NFTMint123',
            wallet_address: walletAddress,
            stake_timestamp: twentyFourHoursAgo,
            unstake_fee: 0.01,
            collection_name: 'Test Collection'
          }]
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE query
        .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT transaction
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(true);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
    });

    test('should allow unstake if NFT staked more than 24 hours ago', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1];
      
      // NFT staked 48 hours ago (should be allowed)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      mockConnection.query
        .mockResolvedValueOnce([
          [{
            id: 1,
            mint_address: 'NFTMint123',
            wallet_address: walletAddress,
            stake_timestamp: fortyEightHoursAgo,
            unstake_fee: 0.01,
            collection_name: 'Test Collection'
          }]
        ])
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE query
        .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT transaction
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(true);
      expect(mockConnection.commit).toHaveBeenCalled();
    });
  });

  describe('Requirement 25.2: Return HTTP 400 if too early', () => {
    test('should return error message with remaining time', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1];
      
      // NFT staked 1 hour ago
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      
      mockConnection.query.mockResolvedValueOnce([
        [{
          id: 1,
          mint_address: 'NFTMint123',
          wallet_address: walletAddress,
          stake_timestamp: oneHourAgo,
          unstake_fee: 0.01,
          collection_name: 'Test Collection'
        }]
      ]);
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('23h remaining');
    });

    test('should handle multiple NFTs with different lock times', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1, 2];
      
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      mockConnection.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            mint_address: 'NFTMint1',
            wallet_address: walletAddress,
            stake_timestamp: oneHourAgo,
            unstake_fee: 0.01,
            collection_name: 'Test Collection'
          },
          {
            id: 2,
            mint_address: 'NFTMint2',
            wallet_address: walletAddress,
            stake_timestamp: twelveHoursAgo,
            unstake_fee: 0.01,
            collection_name: 'Test Collection'
          }
        ]
      ]);
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('2 NFT(s) still locked');
      expect(result.message).toContain('NFTMint1');
      expect(result.message).toContain('NFTMint2');
    });
  });

  describe('Requirement 25.4: Display remaining lock time', () => {
    test('should calculate and return remaining lock time for each staked NFT', async () => {
      const walletAddress = 'TestWallet123';
      
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      // Mock returns [rows, fields] format
      const mockQueryFn = jest.fn().mockResolvedValueOnce([
        [
          {
            id: 1,
            mint_address: 'NFTMint1',
            wallet_address: walletAddress,
            stake_timestamp: twelveHoursAgo,
            collection_name: 'Test Collection'
          },
          {
            id: 2,
            mint_address: 'NFTMint2',
            wallet_address: walletAddress,
            stake_timestamp: twentyFiveHoursAgo,
            collection_name: 'Test Collection'
          }
        ],
        [] // fields
      ]);
      
      mockPool.promise.mockReturnValueOnce({
        query: mockQueryFn,
        getConnection: mockPool.promise().getConnection
      });
      
      const result = await getStakedNFTs(walletAddress);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      // First NFT should have remaining lock time
      expect(result.data[0].remainingLockTimeMs).toBeGreaterThan(0);
      expect(result.data[0].remainingLockTimeHours).toBeGreaterThan(0);
      expect(result.data[0].canUnstake).toBe(false);
      
      // Second NFT should have no remaining lock time
      expect(result.data[1].remainingLockTimeMs).toBe(0);
      expect(result.data[1].remainingLockTimeHours).toBe(0);
      expect(result.data[1].canUnstake).toBe(true);
    });

    test('should return canUnstake flag correctly', async () => {
      const walletAddress = 'TestWallet123';
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const mockQueryFn = jest.fn().mockResolvedValueOnce([
        [{
          id: 1,
          mint_address: 'NFTMint1',
          wallet_address: walletAddress,
          stake_timestamp: twentyFourHoursAgo,
          collection_name: 'Test Collection'
        }],
        [] // fields
      ]);
      
      mockPool.promise.mockReturnValueOnce({
        query: mockQueryFn,
        getConnection: mockPool.promise().getConnection
      });
      
      const result = await getStakedNFTs(walletAddress);
      
      expect(result.success).toBe(true);
      expect(result.data[0].canUnstake).toBe(true);
      expect(result.data[0].remainingLockTimeMs).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle NFT staked at exact boundary (24 hours - 1 second)', async () => {
      const walletAddress = 'TestWallet123';
      const nftIds = [1];
      
      // 24 hours minus 1 second (should be rejected)
      const almostTwentyFourHours = new Date(Date.now() - (24 * 60 * 60 * 1000 - 1000));
      
      mockConnection.query.mockResolvedValueOnce([
        [{
          id: 1,
          mint_address: 'NFTMint123',
          wallet_address: walletAddress,
          stake_timestamp: almostTwentyFourHours,
          unstake_fee: 0.01,
          collection_name: 'Test Collection'
        }]
      ]);
      
      const result = await unstakeNFTs(walletAddress, nftIds);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Minimum stake duration');
    });

    test('should handle empty staked NFTs list', async () => {
      const walletAddress = 'TestWallet123';
      
      const mockQueryFn = jest.fn().mockResolvedValueOnce([[], []]); // [rows, fields]
      
      mockPool.promise.mockReturnValueOnce({
        query: mockQueryFn,
        getConnection: mockPool.promise().getConnection
      });
      
      const result = await getStakedNFTs(walletAddress);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
});
