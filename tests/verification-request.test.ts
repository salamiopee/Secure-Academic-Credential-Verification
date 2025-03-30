import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM environment
const mockVM = {
  blockHeight: 100,
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  // Constants
  STATUS_PENDING: "pending",
  STATUS_APPROVED: "approved",
  STATUS_REJECTED: "rejected",
  
  // Mock data storage
  dataMap: {
    verificationRequests: {},
    authorizedVerifiers: {}
  },
  
  // Mock contract functions
  registerVerifier: function(name) {
    if (this.txSender !== this.contractOwner) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    this.dataMap.authorizedVerifiers[this.txSender] = {
      name,
      active: true,
      registrationDate: this.blockHeight
    };
    
    return { success: true };
  },
  
  createVerificationRequest: function(requestId, credentialId) {
    if (this.dataMap.verificationRequests[requestId]) {
      return { error: 2 }; // ERR_ALREADY_EXISTS
    }
    
    this.dataMap.verificationRequests[requestId] = {
      requester: this.txSender,
      credentialId,
      requestDate: this.blockHeight,
      status: this.STATUS_PENDING,
      responseDate: 0,
      verifier: this.txSender
    };
    
    return { success: true };
  },
  
  respondToVerification: function(requestId, status) {
    if (!this.dataMap.authorizedVerifiers[this.txSender]) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    if (status !== this.STATUS_APPROVED && status !== this.STATUS_REJECTED) {
      return { error: 4 }; // ERR_INVALID_STATUS
    }
    
    if (!this.dataMap.verificationRequests[requestId]) {
      return { error: 3 }; // ERR_NOT_FOUND
    }
    
    this.dataMap.verificationRequests[requestId].status = status;
    this.dataMap.verificationRequests[requestId].responseDate = this.blockHeight;
    this.dataMap.verificationRequests[requestId].verifier = this.txSender;
    
    return { success: true };
  },
  
  deactivateVerifier: function(verifier) {
    if (this.txSender !== this.contractOwner) {
      return { error: 1 }; // ERR_UNAUTHORIZED
    }
    
    if (!this.dataMap.authorizedVerifiers[verifier]) {
      return { error: 3 }; // ERR_NOT_FOUND
    }
    
    this.dataMap.authorizedVerifiers[verifier].active = false;
    return { success: true };
  },
  
  getVerificationRequest: function(requestId) {
    return this.dataMap.verificationRequests[requestId] || null;
  },
  
  getVerifier: function(verifier) {
    return this.dataMap.authorizedVerifiers[verifier] || null;
  }
};

describe('Verification Request Contract', () => {
  beforeEach(() => {
    // Reset the mock VM state before each test
    mockVM.blockHeight = 100;
    mockVM.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockVM.dataMap = {
      verificationRequests: {},
      authorizedVerifiers: {}
    };
  });
  
  describe('registerVerifier', () => {
    it('should register a new verifier when called by contract owner', () => {
      const result = mockVM.registerVerifier('Verification Agency');
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.authorizedVerifiers[mockVM.txSender]).toBeDefined();
      expect(mockVM.dataMap.authorizedVerifiers[mockVM.txSender].name).toBe('Verification Agency');
      expect(mockVM.dataMap.authorizedVerifiers[mockVM.txSender].active).toBe(true);
    });
    
    it('should not register a verifier when called by non-owner', () => {
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      const result = mockVM.registerVerifier('Verification Agency');
      expect(result.error).toBe(1); // ERR_UNAUTHORIZED
    });
  });
  
  describe('createVerificationRequest', () => {
    it('should create a verification request', () => {
      const result = mockVM.createVerificationRequest('req123', 'cred123');
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.verificationRequests['req123']).toBeDefined();
      expect(mockVM.dataMap.verificationRequests['req123'].credentialId).toBe('cred123');
      expect(mockVM.dataMap.verificationRequests['req123'].status).toBe(mockVM.STATUS_PENDING);
    });
    
    it('should not create a duplicate verification request', () => {
      mockVM.createVerificationRequest('req123', 'cred123');
      const result = mockVM.createVerificationRequest('req123', 'cred456');
      expect(result.error).toBe(2); // ERR_ALREADY_EXISTS
    });
  });
  
  describe('respondToVerification', () => {
    it('should allow authorized verifier to respond to a request', () => {
      // Register verifier
      mockVM.registerVerifier('Verification Agency');
      
      // Create request
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.createVerificationRequest('req123', 'cred123');
      
      // Respond to request
      mockVM.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Authorized verifier
      const result = mockVM.respondToVerification('req123', mockVM.STATUS_APPROVED);
      
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.verificationRequests['req123'].status).toBe(mockVM.STATUS_APPROVED);
      expect(mockVM.dataMap.verificationRequests['req123'].verifier).toBe(mockVM.txSender);
    });
    
    it('should not allow unauthorized user to respond to a request', () => {
      // Create request
      mockVM.createVerificationRequest('req123', 'cred123');
      
      // Try to respond as unauthorized user
      mockVM.txSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      const result = mockVM.respondToVerification('req123', mockVM.STATUS_APPROVED);
      
      expect(result.error).toBe(1); // ERR_UNAUTHORIZED
    });
    
    it('should not allow invalid status values', () => {
      // Register verifier
      mockVM.registerVerifier('Verification Agency');
      
      // Create request
      mockVM.createVerificationRequest('req123', 'cred123');
      
      // Try to respond with invalid status
      const result = mockVM.respondToVerification('req123', 'invalid-status');
      
      expect(result.error).toBe(4); // ERR_INVALID_STATUS
    });
  });
  
  describe('deactivateVerifier', () => {
    it('should deactivate a verifier when called by contract owner', () => {
      // Register verifier
      const verifier = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.txSender = mockVM.contractOwner;
      mockVM.dataMap.authorizedVerifiers[verifier] = {
        name: 'Verification Agency',
        active: true,
        registrationDate: mockVM.blockHeight
      };
      
      // Deactivate verifier
      const result = mockVM.deactivateVerifier(verifier);
      
      expect(result.success).toBe(true);
      expect(mockVM.dataMap.authorizedVerifiers[verifier].active).toBe(false);
    });
    
    it('should not deactivate a verifier when called by non-owner', () => {
      // Register verifier
      const verifier = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      mockVM.txSender = mockVM.contractOwner;
      mockVM.dataMap.authorizedVerifiers[verifier] = {
        name: 'Verification Agency',
        active: true,
        registrationDate: mockVM.blockHeight
      };
      
      // Try to deactivate as non-owner
      mockVM.txSender = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH7B0RZ3';
      const result = mockVM.deactivateVerifier(verifier);
      
      expect(result.error).toBe(1); // ERR_UNAUTHORIZED
    });
  });
});
