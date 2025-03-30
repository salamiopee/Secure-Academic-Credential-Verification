import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM environment
const mockVM = {
  blockHeight: 100,
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  // Mock data storage
  dataMap: {
    credentials: {},
    issuerRegistry: {}
  },
  
  // Mock contract functions
  registerIssuer: function(name) {
    const issuer = this.txSender;
    if (this.dataMap.issuerRegistry[issuer]) {
      return { error: 2 }; // ERR_ALREADY_EXISTS
    }
    
    this.dataMap.issuerRegistry[issuer] = {
      name,
      verified: false,
      registrationDate: this.blockHeight
    };
    
    return { success: true };
  },
  
  verifyIssuer: function(issuer) {
    if (this.txSender !== this.contractOwner) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    if (!this.dataMap.issuerRegistry[issuer]) {
      return { error: 3 }; // ERR_NOT_FOUND
    }
    
    this.dataMap.issuerRegistry[issuer].verified = true;
    return { success: true };
  },
  
  issueCredential: function(credentialId, recipient, credentialType, expirationDate, metadataUri) {
    const issuer = this.txSender;
    
    if (!this.dataMap.issuerRegistry[issuer]) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    if (this.dataMap.credentials[credentialId]) {
      return { error: 2 }; // ERR_ALREADY_EXISTS
    }
    
    if (expirationDate < this.blockHeight) {
      return { error: 4 }; // ERR_INVALID_INPUT
    }
    
    this.dataMap.credentials[credentialId] = {
      recipient,
      issuer,
      credentialType,
      issueDate: this.blockHeight,
      expirationDate,
      metadataUri,
      revoked: false
    };
    
    return { success: true };
  },
  
  revokeCredential: function(credentialId) {
    if (!this.dataMap.credentials[credentialId]) {
      return { error: 3 }; // ERR_NOT_FOUND
    }
    
    if (this.dataMap.credentials[credentialId].issuer !== this.txSender) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    this.dataMap.credentials[credentialId].revoked = true;
    return { success: true };
  },
  
  getCredential: function(credentialId) {
    return this.dataMap.credentials[credentialId] || null;
  },
  
  isCredentialValid: function(credentialId) {
    const credential = this.dataMap.credentials[credentialId];
    if (!credential) {
      return false;
    }
    
    return !credential.revoked && credential.expirationDate >= this.blockHeight;
  }
};

describe('Credential Issuance Contract', () => {
  beforeEach(() => {
    // Reset the mock VM state before each test
    mockVM.blockHeight = 100;
    mockVM.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockVM.dataMap = {
      credentials: {},
      issuerRegistry: {}
    };
  });
  
  describe('registerIssuer', () => {
    it('should register a new issuer', () => {
      const result = mockVM.registerIssuer('Test University');
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.issuerRegistry[mockVM.txSender]).toBeDefined();
      expect(mockVM.dataMap.issuerRegistry[mockVM.txSender].name).toBe('Test University');
      expect(mockVM.dataMap.issuerRegistry[mockVM.txSender].verified).toBe(false);
    });
    
    it('should not register an issuer twice', () => {
      mockVM.registerIssuer('Test University');
      const result = mockVM.registerIssuer('Test University Again');
      expect(result.error).toBe(2); // ERR_ALREADY_EXISTS
    });
  });
  
  describe('verifyIssuer', () => {
    it('should verify an issuer when called by contract owner', () => {
      const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.txSender = issuer;
      mockVM.registerIssuer('Test University');
      
      mockVM.txSender = mockVM.contractOwner;
      const result = mockVM.verifyIssuer(issuer);
      
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.issuerRegistry[issuer].verified).toBe(true);
    });
    
    it('should not verify an issuer when called by non-owner', () => {
      const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.txSender = issuer;
      mockVM.registerIssuer('Test University');
      
      mockVM.txSender = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3';
      const result = mockVM.verifyIssuer(issuer);
      
      expect(result.error).toBe(1); // ERR_UNAUTHORIZED
    });
  });
  
  describe('issueCredential', () => {
    it('should issue a credential when called by a registered issuer', () => {
      // Register issuer
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      
      // Issue credential
      const result = mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          200, // expiration date
          'ipfs://QmCredentialMetadata'
      );
      
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.credentials['cred123']).toBeDefined();
      expect(mockVM.dataMap.credentials['cred123'].credentialType).toBe('Bachelor of Science');
    });
    
    it('should not issue a credential with an expired date', () => {
      // Register issuer
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      
      // Issue credential with past expiration date
      const result = mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          50, // expiration date in the past
          'ipfs://QmCredentialMetadata'
      );
      
      expect(result.error).toBe(4); // ERR_INVALID_INPUT
    });
  });
  
  describe('revokeCredential', () => {
    it('should revoke a credential when called by the issuer', () => {
      // Register issuer and issue credential
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          200,
          'ipfs://QmCredentialMetadata'
      );
      
      // Revoke credential
      const result = mockVM.revokeCredential('cred123');
      
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.credentials['cred123'].revoked).toBe(true);
    });
    
    it('should not allow non-issuer to revoke a credential', () => {
      // Register issuer and issue credential
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          200,
          'ipfs://QmCredentialMetadata'
      );
      
      // Try to revoke as different user
      mockVM.txSender = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3';
      const result = mockVM.revokeCredential('cred123');
      
      expect(result.error).toBe(1); // ERR_UNAUTHORIZED
    });
  });
  
  describe('isCredentialValid', () => {
    it('should return true for valid credentials', () => {
      // Register issuer and issue credential
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          200,
          'ipfs://QmCredentialMetadata'
      );
      
      const isValid = mockVM.isCredentialValid('cred123');
      expect(isValid).toBe(true);
    });
    
    it('should return false for revoked credentials', () => {
      // Register issuer, issue and revoke credential
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          200,
          'ipfs://QmCredentialMetadata'
      );
      mockVM.revokeCredential('cred123');
      
      const isValid = mockVM.isCredentialValid('cred123');
      expect(isValid).toBe(false);
    });
    
    it('should return false for expired credentials', () => {
      // Register issuer and issue credential
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.registerIssuer('Test University');
      mockVM.issueCredential(
          'cred123',
          'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3',
          'Bachelor of Science',
          150,
          'ipfs://QmCredentialMetadata'
      );
      
      // Fast forward block height to make credential expire
      mockVM.blockHeight = 151;
      
      const isValid = mockVM.isCredentialValid('cred123');
      expect(isValid).toBe(false);
    });
  });
});
