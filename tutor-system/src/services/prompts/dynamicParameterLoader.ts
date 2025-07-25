/**
 * Dynamic Parameter Loader
 * Automatically loads parameter configurations from the pedagogy/parameters folder
 * This ensures that adding/removing parameter files automatically updates the system
 */

import { ROLE_PARAMETERS } from './pedagogy/parameters/roleParameters';
import { COMMUNICATION_STYLES } from './pedagogy/parameters/communicationStyles';
import { COGNITIVE_PARAMETERS } from './pedagogy/parameters/cognitiveParameters';
import { EMOTIONAL_PARAMETERS } from './pedagogy/parameters/emotionalParameters';

// Dynamic parameter registry - automatically populated from imported modules
const PARAMETER_MODULES = {
  role: ROLE_PARAMETERS,
  communication_style: COMMUNICATION_STYLES,
  cognitive_parameters: COGNITIVE_PARAMETERS,
  emotional_parameters: EMOTIONAL_PARAMETERS
} as const;

/**
 * Dynamically generate parameter selection configuration structure
 * based on what's actually available in the parameter files
 */
export const generateParameterSelectionStructure = () => {
  const structure: any = {};
  
  // Process each parameter module
  Object.entries(PARAMETER_MODULES).forEach(([moduleKey, moduleConfig]) => {
    // All parameter types now follow the same structure
    structure[moduleKey] = {
      enabled: true,
      parameters: Object.keys(moduleConfig).reduce((acc, paramName) => {
        acc[paramName] = true; // Default all parameters to enabled
        return acc;
      }, {} as Record<string, boolean>)
    };
  });
  
  return structure;
};

/**
 * Get all available parameter names organized by category
 */
export const getAvailableParameters = () => {
  const parameters: any = {};
  
  Object.entries(PARAMETER_MODULES).forEach(([moduleKey, moduleConfig]) => {
    parameters[moduleKey] = Object.keys(moduleConfig);
  });
  
  return parameters;
};

/**
 * Generate parameter metadata dynamically from the loaded modules
 * Uses original parameter names and descriptions from the parameter files
 */
export const generateParameterMetadata = () => {
  const metadata: any = {};
  
  // Generate metadata for all parameter modules using the same pattern
  Object.entries(PARAMETER_MODULES).forEach(([moduleKey, moduleConfig]) => {
    metadata[moduleKey] = {
      label: moduleKey,
      parameters: Object.entries(moduleConfig).reduce((acc, [paramKey, paramConfig]) => {
        acc[paramKey] = {
          label: paramKey, // Use original parameter name
          low: paramConfig.low, // Use original low description
          high: paramConfig.high, // Use original high description
          labels: paramConfig.labels || { low: 'low', high: 'high' } // Use custom labels or default to low/high
        };
        return acc;
      }, {} as Record<string, any>)
    };
  });
  
  return metadata;
};

/**
 * Generate TypeScript interface string for ParameterOverrides based on available parameters
 * This can be used for development-time type generation
 */
export const generateParameterOverridesInterface = () => {
  const availableParams = getAvailableParameters();
  
  let interfaceString = 'interface DynamicParameterOverrides {\n';
  
  Object.entries(availableParams).forEach(([moduleKey, paramNames]) => {
    interfaceString += `  ${moduleKey}?: {\n`;
    (paramNames as string[]).forEach(paramName => {
      interfaceString += `    ${paramName}?: 'low' | 'high';\n`;
    });
    interfaceString += '  };\n';
  });
  
  interfaceString += '}';
  
  return interfaceString;
};

/**
 * Create default parameter values based on what's available
 */
export const createDynamicDefaultParameters = (config?: any) => {
  const defaults: any = {};
  const availableParams = getAvailableParameters();
  
  // Set defaults for all parameter categories using the same pattern
  Object.entries(availableParams).forEach(([moduleKey, paramNames]) => {
    if (paramNames && (paramNames as string[]).length > 0) {
      defaults[moduleKey] = {};
      (paramNames as string[]).forEach(paramName => {
        // Smart defaults based on parameter name patterns
        if (paramName.includes('uncertainty') || paramName.includes('concept_density')) {
          defaults[moduleKey][paramName] = 'low';
        } else {
          defaults[moduleKey][paramName] = 'high';
        }
      });
    }
  });
  
  return defaults;
};

/**
 * Validate that a parameter override object only contains valid parameter names
 */
export const validateParameterOverrides = (overrides: any): boolean => {
  const availableParams = getAvailableParameters();
  
  try {
    Object.entries(overrides).forEach(([moduleKey, moduleValue]) => {
      if (!availableParams[moduleKey]) {
        console.warn(`Invalid parameter module: ${moduleKey}`);
        return false;
      }
      
      if (typeof moduleValue === 'object' && moduleValue !== null) {
        Object.keys(moduleValue).forEach(paramName => {
          if (!availableParams[moduleKey].includes(paramName)) {
            console.warn(`Invalid parameter name: ${moduleKey}.${paramName}`);
            return false;
          }
        });
      }
    });
    
    return true;
  } catch (error) {
    console.error('Parameter validation failed:', error);
    return false;
  }
};

// Export the dynamic configuration structure
export const DYNAMIC_PARAMETER_SELECTION = generateParameterSelectionStructure();
export const DYNAMIC_PARAMETER_METADATA = generateParameterMetadata();

// Log the dynamically generated structure for debugging
console.log('🔄 Dynamically loaded parameter structure:');
console.log('📋 Available parameters by category:');
Object.entries(getAvailableParameters()).forEach(([category, params]) => {
  console.log(`  ${category}: [${(params as string[]).join(', ')}]`);
});
console.log('✨ All parameters loaded with original names and descriptions');