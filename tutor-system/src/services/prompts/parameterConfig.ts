/**
 * Utility functions for parameter configuration management
 * Now uses dynamic parameter loading from the prompts folder structure
 */

// ParameterSelectionConfig is now dynamically generated
import { 
  DYNAMIC_PARAMETER_SELECTION, 
  DYNAMIC_PARAMETER_METADATA,
  generateParameterSelectionStructure,
  createDynamicDefaultParameters,
  validateParameterOverrides as dynamicValidateParameterOverrides
} from './dynamicParameterLoader';

/**
 * Get parameter metadata dynamically from the prompts folder structure
 */
export const getParameterMetadata = () => DYNAMIC_PARAMETER_METADATA;

/**
 * Validate parameter configuration dynamically
 */
export const validateParameterConfig = (config: any): boolean => {
  try {
    // Check if at least one category is enabled
    const enabledCategories = Object.values(config).filter((category: any) => category.enabled);
    
    if (enabledCategories.length === 0) {
      console.warn('Parameter config validation: No categories enabled');
      return false;
    }

    // Validate each enabled category
    for (const [categoryKey, categoryConfig] of Object.entries(config)) {
      const category = categoryConfig as any;
      
      if (!category.enabled) continue;
      
      if (!category.parameters || Object.keys(category.parameters).length === 0) {
        console.warn(`Parameter config validation: ${categoryKey} enabled but no parameters defined`);
        return false;
      }
      
      const hasEnabledParam = Object.values(category.parameters).some(Boolean);
      if (!hasEnabledParam) {
        console.warn(`Parameter config validation: ${categoryKey} enabled but no parameters enabled`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Parameter config validation failed:', error);
    return false;
  }
};

/**
 * Filter parameter overrides based on configuration
 */
export const filterParameterOverrides = (
  overrides: any,
  config: any
): any => {
  const filtered: any = {};

  // Dynamically filter parameters based on configuration
  Object.entries(config).forEach(([categoryKey, categoryConfig]: [string, any]) => {
    if (!categoryConfig?.enabled || !overrides[categoryKey]) {
      return;
    }

    if (categoryConfig.parameters) {
      // Handle all parameter categories consistently
      filtered[categoryKey] = {};
      Object.entries(categoryConfig.parameters).forEach(([paramKey, enabled]) => {
        if (enabled && overrides[categoryKey][paramKey]) {
          filtered[categoryKey][paramKey] = overrides[categoryKey][paramKey];
        }
      });
    }
  });

  return filtered;
};

/**
 * Validate parameter overrides using dynamic validation
 */
export const validateParameterOverrides = (overrides: any): boolean => {
  return dynamicValidateParameterOverrides(overrides);
};

/**
 * Get the default dynamic parameter selection configuration
 */
export const getDefaultParameterSelection = () => DYNAMIC_PARAMETER_SELECTION;

/**
 * Create default parameter values dynamically based on configuration
 */
export const createDefaultParameters = (config: any): any => {
  // Use the dynamic default parameter creation
  return createDynamicDefaultParameters(config);
};

/**
 * Get configuration for a specific use case (dynamically generated)
 */
export const getConfigurationPreset = (preset: 'minimal' | 'standard' | 'advanced'): any => {
  const fullConfig = generateParameterSelectionStructure();
  
  switch (preset) {
    case 'minimal':
      // Enable only the first parameter in each category
      const minimalConfig = JSON.parse(JSON.stringify(fullConfig));
      Object.entries(minimalConfig).forEach(([categoryKey, categoryConfig]: [string, any]) => {
        if (categoryKey === 'role') {
          // Keep all role options for minimal
          return;
        } else if (categoryConfig.parameters) {
          const paramKeys = Object.keys(categoryConfig.parameters);
          Object.keys(categoryConfig.parameters).forEach((paramKey, index) => {
            categoryConfig.parameters[paramKey] = index === 0; // Only enable first parameter
          });
        }
      });
      return minimalConfig;
    
    case 'advanced':
      return fullConfig; // All parameters enabled
    
    case 'standard':
    default:
      // Enable ALL parameters in each category for maximum flexibility
      return fullConfig; // Show all parameters just like 'advanced' mode
  }
};