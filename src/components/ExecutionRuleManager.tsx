import React, { useState, useEffect } from 'react';
import './ExecutionRuleManager.css';

interface ExecutionRule {
  id: number;
  rule_name: string;
  rule_type: 'location' | 'proximity' | 'geofence';
  contract_id: number;
  contract_name?: string;
  contract_address?: string;
  function_name: string;
  center_latitude?: number;
  center_longitude?: number;
  radius_meters?: number;
  trigger_on?: 'enter' | 'exit' | 'both';
  auto_execute?: boolean;
  is_active?: boolean;
  created_at?: string;
}

interface Contract {
  id: number;
  contract_address: string;
  contract_name: string;
  discovered_functions?: any[];
}

interface ExecutionRuleManagerProps {
  walletAddress: string;
}

export const ExecutionRuleManager: React.FC<ExecutionRuleManagerProps> = ({ walletAddress }) => {
  const [rules, setRules] = useState<ExecutionRule[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    rule_type: 'location' as 'location' | 'proximity' | 'geofence',
    center_latitude: '',
    center_longitude: '',
    radius_meters: '1000',
    function_name: '',
    function_parameters: {} as Record<string, any>,
    trigger_on: 'enter' as 'enter' | 'exit' | 'both',
    auto_execute: false,
    target_wallet_public_key: '',
  });

  useEffect(() => {
    loadContracts();
    loadRules();
  }, [walletAddress]);

  const loadContracts = async () => {
    try {
      const apiUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
      const apiKey = process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || '';
      
      if (!apiKey) {
        console.warn('[ExecutionRuleManager] API key not configured');
        return;
      }

      const response = await fetch(`${apiUrl}/api/contracts`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      const data = await response.json();
      if (data.success && data.contracts) {
        setContracts(data.contracts);
      }
    } catch (error) {
      console.error('[ExecutionRuleManager] Failed to load contracts:', error);
    }
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
      const apiKey = process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || '';
      
      if (!apiKey) {
        console.warn('[ExecutionRuleManager] API key not configured');
        return;
      }

      const response = await fetch(`${apiUrl}/api/contracts/rules`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      const data = await response.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('[ExecutionRuleManager] Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!selectedContract || !ruleForm.rule_name || !ruleForm.function_name) {
      alert('Please fill in all required fields');
      return;
    }

    if (ruleForm.rule_type === 'location' || ruleForm.rule_type === 'proximity') {
      if (!ruleForm.center_latitude || !ruleForm.center_longitude || !ruleForm.radius_meters) {
        alert('Please provide location coordinates and radius');
        return;
      }
    }

    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
      const apiKey = process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || '';
      
      const requestBody: any = {
        contract_id: selectedContract.id,
        rule_name: ruleForm.rule_name,
        rule_type: ruleForm.rule_type,
        function_name: ruleForm.function_name,
        function_parameters: ruleForm.function_parameters,
        trigger_on: ruleForm.trigger_on,
        auto_execute: ruleForm.auto_execute,
      };

      if (ruleForm.rule_type === 'location' || ruleForm.rule_type === 'proximity') {
        requestBody.center_latitude = parseFloat(ruleForm.center_latitude);
        requestBody.center_longitude = parseFloat(ruleForm.center_longitude);
        requestBody.radius_meters = parseInt(ruleForm.radius_meters);
      }

      if (ruleForm.target_wallet_public_key) {
        requestBody.target_wallet_public_key = ruleForm.target_wallet_public_key;
      }

      const response = await fetch(`${apiUrl}/api/contracts/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (data.success) {
        alert('Execution rule created successfully!');
        setShowCreateForm(false);
        setRuleForm({
          rule_name: '',
          rule_type: 'location',
          center_latitude: '',
          center_longitude: '',
          radius_meters: '1000',
          function_name: '',
          function_parameters: {},
          trigger_on: 'enter',
          auto_execute: false,
          target_wallet_public_key: '',
        });
        setSelectedContract(null);
        setSelectedFunction('');
        loadRules();
      } else {
        throw new Error(data.error || 'Failed to create rule');
      }
    } catch (error: any) {
      console.error('[ExecutionRuleManager] Failed to create rule:', error);
      alert(`Failed to create rule: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      const apiUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
      const apiKey = process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || '';
      
      const response = await fetch(`${apiUrl}/api/contracts/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      const data = await response.json();
      if (data.success) {
        alert('Rule deleted successfully!');
        loadRules();
      } else {
        throw new Error(data.error || 'Failed to delete rule');
      }
    } catch (error: any) {
      console.error('[ExecutionRuleManager] Failed to delete rule:', error);
      alert(`Failed to delete rule: ${error.message || error}`);
    }
  };

  const getContractFunctions = (contract: Contract) => {
    if (!contract.discovered_functions) return [];
    if (Array.isArray(contract.discovered_functions)) {
      return contract.discovered_functions;
    }
    if (typeof contract.discovered_functions === 'object') {
      return Object.values(contract.discovered_functions);
    }
    return [];
  };

  return (
    <div className="execution-rule-manager">
      <div className="execution-rule-manager-header">
        <h3>Execution Rules</h3>
        <button
          className="primary-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ Create Rule'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-rule-form">
          <h4>Create Execution Rule</h4>
          
          <div className="form-group">
            <label>Rule Name *</label>
            <input
              type="text"
              value={ruleForm.rule_name}
              onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
              placeholder="Payment at Location X"
            />
          </div>

          <div className="form-group">
            <label>Contract *</label>
            <select
              value={selectedContract?.id || ''}
              onChange={(e) => {
                const contract = contracts.find(c => c.id === parseInt(e.target.value));
                setSelectedContract(contract || null);
                setSelectedFunction('');
                setRuleForm({ ...ruleForm, function_name: '' });
              }}
            >
              <option value="">Select a contract...</option>
              {contracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_name} ({contract.contract_address.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>

          {selectedContract && (
            <div className="form-group">
              <label>Function *</label>
              <select
                value={selectedFunction}
                onChange={(e) => {
                  setSelectedFunction(e.target.value);
                  setRuleForm({ ...ruleForm, function_name: e.target.value });
                }}
              >
                <option value="">Select a function...</option>
                {getContractFunctions(selectedContract).map((func: any, index: number) => (
                  <option key={index} value={func.name}>
                    {func.name} {func.signature ? `(${func.signature})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Rule Type *</label>
            <select
              value={ruleForm.rule_type}
              onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value as any })}
            >
              <option value="location">Location (Radius)</option>
              <option value="proximity">Proximity</option>
              <option value="geofence">Geofence</option>
            </select>
          </div>

          {(ruleForm.rule_type === 'location' || ruleForm.rule_type === 'proximity') && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={ruleForm.center_latitude}
                    onChange={(e) => setRuleForm({ ...ruleForm, center_latitude: e.target.value })}
                    placeholder="34.0164"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={ruleForm.center_longitude}
                    onChange={(e) => setRuleForm({ ...ruleForm, center_longitude: e.target.value })}
                    placeholder="-118.4951"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Radius (meters) *</label>
                <input
                  type="number"
                  value={ruleForm.radius_meters}
                  onChange={(e) => setRuleForm({ ...ruleForm, radius_meters: e.target.value })}
                  placeholder="1000"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Trigger On *</label>
            <select
              value={ruleForm.trigger_on}
              onChange={(e) => setRuleForm({ ...ruleForm, trigger_on: e.target.value as any })}
            >
              <option value="enter">Enter</option>
              <option value="exit">Exit</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={ruleForm.auto_execute}
                onChange={(e) => setRuleForm({ ...ruleForm, auto_execute: e.target.checked })}
              />
              Auto-execute (no confirmation required)
            </label>
          </div>

          <div className="form-group">
            <label>Target Wallet (optional)</label>
            <input
              type="text"
              value={ruleForm.target_wallet_public_key}
              onChange={(e) => setRuleForm({ ...ruleForm, target_wallet_public_key: e.target.value })}
              placeholder="Leave empty for any wallet"
            />
          </div>

          <button
            className="primary-button"
            onClick={handleCreateRule}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Rule'}
          </button>
        </div>
      )}

      <div className="rules-list">
        <h4>Your Rules ({rules.length})</h4>
        {loading && rules.length === 0 ? (
          <div className="loading">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="no-rules">No execution rules found. Create your first rule above.</div>
        ) : (
          <div className="rules-grid">
            {rules.map(rule => (
              <div key={rule.id} className="rule-card">
                <div className="rule-card-header">
                  <h5>{rule.rule_name}</h5>
                  <span className={`rule-status ${rule.is_active ? 'active' : 'inactive'}`}>
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="rule-card-body">
                  <div className="rule-info">
                    <strong>Contract:</strong> {rule.contract_name || 'Unknown'}
                  </div>
                  <div className="rule-info">
                    <strong>Function:</strong> {rule.function_name}
                  </div>
                  {rule.center_latitude && rule.center_longitude && (
                    <div className="rule-info">
                      <strong>Location:</strong> {rule.center_latitude.toFixed(4)}, {rule.center_longitude.toFixed(4)}
                    </div>
                  )}
                  {rule.radius_meters && (
                    <div className="rule-info">
                      <strong>Radius:</strong> {rule.radius_meters}m
                    </div>
                  )}
                  <div className="rule-info">
                    <strong>Trigger:</strong> {rule.trigger_on || 'enter'}
                  </div>
                  <div className="rule-info">
                    <strong>Auto-execute:</strong> {rule.auto_execute ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="rule-card-actions">
                  <button
                    className="danger-button"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
