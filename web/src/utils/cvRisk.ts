
export type Gender = 'Men' | 'Women';
export type SmokingStatus = 'Non-smoker' | 'Smoker';

export interface CVRiskInputs {
  age: number;
  gender: Gender;
  isSmoker: boolean;
  bmi: number;
  sbp: number;
  hasDiabetes: boolean;
}

// WHO Non-laboratory based risk chart for South Asia
// Data structure: [AgeGroup][Gender][SmokingStatus][SBP_Index][BMI_Index]
// SBP_Index: 0:<120, 1:120-139, 2:140-159, 3:160-179, 4:>=180
// BMI_Index: 0:<20, 1:20-24, 2:25-29, 3:30-35, 4:>=35

const riskData: Record<string, Record<Gender, Record<SmokingStatus, number[][]>>> = {
  '40-44': {
    'Men': {
      'Non-smoker': [
        [2, 2, 2, 2, 3],
        [2, 2, 3, 3, 4],
        [3, 3, 4, 5, 5],
        [4, 5, 5, 6, 8],
        [5, 6, 7, 9, 10]
      ],
      'Smoker': [
        [3, 3, 4, 5, 6],
        [4, 5, 6, 7, 8],
        [5, 6, 8, 9, 11],
        [8, 9, 11, 13, 15],
        [10, 12, 14, 17, 20]
      ]
    },
    'Women': {
      'Non-smoker': [
        [1, 1, 1, 2, 2],
        [2, 2, 2, 2, 2],
        [2, 3, 3, 3, 3],
        [3, 4, 4, 4, 4],
        [5, 5, 5, 6, 6]
      ],
      'Smoker': [
        [3, 3, 4, 4, 4],
        [4, 5, 5, 6, 6],
        [6, 6, 7, 7, 8],
        [8, 9, 9, 10, 11],
        [11, 12, 13, 14, 15]
      ]
    }
  },
  '45-49': {
    'Men': {
      'Non-smoker': [
        [2, 2, 3, 3, 4],
        [3, 3, 4, 4, 5],
        [4, 4, 5, 6, 7],
        [5, 6, 7, 8, 9],
        [7, 8, 9, 11, 12]
      ],
      'Smoker': [
        [4, 4, 5, 6, 7],
        [5, 6, 7, 8, 10],
        [7, 8, 9, 11, 13],
        [9, 11, 13, 15, 17],
        [12, 14, 17, 20, 23]
      ]
    },
    'Women': {
      'Non-smoker': [
        [2, 2, 2, 2, 2],
        [2, 3, 3, 3, 3],
        [3, 4, 4, 4, 4],
        [5, 5, 5, 5, 6],
        [6, 6, 7, 7, 8]
      ],
      'Smoker': [
        [4, 4, 5, 5, 6],
        [6, 6, 6, 7, 7],
        [7, 8, 8, 9, 10],
        [10, 10, 11, 12, 13],
        [13, 14, 15, 16, 17]
      ]
    }
  },
  '50-54': {
    'Men': {
      'Non-smoker': [
        [3, 3, 4, 4, 5],
        [4, 4, 5, 6, 7],
        [5, 6, 7, 8, 9],
        [7, 8, 9, 10, 11],
        [9, 10, 11, 13, 15]
      ],
      'Smoker': [
        [5, 6, 7, 8, 9],
        [7, 8, 9, 10, 12],
        [9, 10, 12, 13, 15],
        [11, 13, 15, 17, 20],
        [15, 17, 20, 22, 26]
      ]
    },
    'Women': {
      'Non-smoker': [
        [3, 3, 3, 3, 3],
        [3, 4, 4, 4, 4],
        [5, 5, 5, 5, 6],
        [6, 6, 7, 7, 7],
        [8, 8, 9, 9, 10]
      ],
      'Smoker': [
        [5, 6, 6, 7, 7],
        [7, 7, 8, 9, 9],
        [9, 10, 10, 11, 12],
        [12, 13, 13, 14, 15],
        [15, 16, 17, 18, 19]
      ]
    }
  },
  '55-59': {
    'Men': {
      'Non-smoker': [
        [4, 5, 5, 6, 7],
        [5, 6, 7, 8, 9],
        [7, 8, 9, 10, 11],
        [9, 10, 11, 13, 14],
        [11, 13, 14, 16, 18]
      ],
      'Smoker': [
        [7, 7, 8, 10, 11],
        [9, 10, 11, 12, 14],
        [11, 12, 14, 16, 18],
        [14, 16, 18, 20, 23],
        [18, 20, 23, 26, 29]
      ]
    },
    'Women': {
      'Non-smoker': [
        [4, 4, 4, 4, 5],
        [5, 5, 5, 6, 6],
        [6, 6, 7, 7, 7],
        [8, 8, 9, 9, 10],
        [10, 10, 11, 11, 12]
      ],
      'Smoker': [
        [7, 7, 8, 8, 9],
        [9, 9, 10, 11, 11],
        [11, 12, 14, 14, 15],
        [14, 15, 16, 17, 18],
        [18, 19, 20, 21, 22]
      ]
    }
  },
  '60-64': {
    'Men': {
      'Non-smoker': [
        [6, 6, 7, 8, 9],
        [7, 8, 9, 10, 11],
        [9, 10, 11, 13, 14],
        [12, 13, 14, 16, 18],
        [15, 16, 18, 20, 22]
      ],
      'Smoker': [
        [9, 10, 11, 12, 13],
        [11, 12, 14, 15, 17],
        [14, 15, 17, 19, 21],
        [17, 19, 21, 24, 26],
        [21, 24, 26, 29, 32]
      ]
    },
    'Women': {
      'Non-smoker': [
        [5, 5, 6, 6, 6],
        [7, 7, 7, 8, 8],
        [8, 9, 9, 9, 10],
        [10, 11, 11, 12, 12],
        [13, 13, 14, 14, 15]
      ],
      'Smoker': [
        [9, 9, 10, 11, 11],
        [11, 12, 12, 13, 14],
        [14, 15, 15, 16, 17],
        [17, 18, 19, 20, 21],
        [21, 22, 23, 24, 26]
      ]
    }
  },
  '65-69': {
    'Men': {
      'Non-smoker': [
        [8, 9, 10, 11, 12],
        [10, 11, 12, 13, 14],
        [12, 14, 15, 16, 18],
        [15, 17, 18, 20, 22],
        [19, 20, 22, 24, 26]
      ],
      'Smoker': [
        [11, 12, 14, 15, 16],
        [14, 15, 17, 18, 20],
        [17, 19, 21, 22, 25],
        [21, 23, 25, 27, 30],
        [26, 28, 30, 33, 36]
      ]
    },
    'Women': {
      'Non-smoker': [
        [7, 8, 8, 8, 9],
        [9, 9, 10, 10, 11],
        [11, 11, 12, 12, 13],
        [13, 14, 14, 15, 16],
        [16, 17, 18, 18, 19]
      ],
      'Smoker': [
        [12, 12, 13, 13, 14],
        [14, 15, 15, 16, 17],
        [17, 18, 19, 20, 21],
        [21, 21, 22, 23, 24],
        [25, 26, 27, 28, 29]
      ]
    }
  },
  '70-74': {
    'Men': {
      'Non-smoker': [
        [11, 12, 13, 14, 15],
        [14, 15, 16, 17, 18],
        [17, 18, 19, 21, 22],
        [20, 22, 23, 25, 27],
        [24, 26, 28, 30, 32]
      ],
      'Smoker': [
        [15, 16, 17, 18, 20],
        [18, 19, 21, 22, 24],
        [22, 23, 25, 27, 28],
        [26, 28, 30, 32, 34],
        [31, 33, 35, 37, 40]
      ]
    },
    'Women': {
      'Non-smoker': [
        [10, 11, 11, 12, 12],
        [12, 13, 13, 14, 14],
        [15, 15, 16, 16, 17],
        [17, 18, 19, 19, 20],
        [21, 21, 22, 23, 24]
      ],
      'Smoker': [
        [15, 15, 16, 17, 17],
        [18, 18, 19, 20, 20],
        [21, 22, 23, 23, 24],
        [25, 26, 26, 27, 28],
        [29, 30, 31, 32, 33]
      ]
    }
  }
};

export const calculateCVRisk = (inputs: CVRiskInputs): number | null => {
  const { age, gender, isSmoker, bmi, sbp, hasDiabetes } = inputs;

  if (isNaN(age) || isNaN(bmi) || isNaN(sbp)) return null;

  // Determine Age Group
  let ageGroup = '';
  if (age >= 40 && age <= 44) ageGroup = '40-44';
  else if (age >= 45 && age <= 49) ageGroup = '45-49';
  else if (age >= 50 && age <= 54) ageGroup = '50-54';
  else if (age >= 55 && age <= 59) ageGroup = '55-59';
  else if (age >= 60 && age <= 64) ageGroup = '60-64';
  else if (age >= 65 && age <= 69) ageGroup = '65-69';
  else if (age >= 70 && age <= 74) ageGroup = '70-74';
  else return null;

  const smokingStatus: SmokingStatus = isSmoker ? 'Smoker' : 'Non-smoker';

  // Determine SBP Index
  let sbpIndex = 0;
  if (sbp < 120) sbpIndex = 0;
  else if (sbp < 140) sbpIndex = 1;
  else if (sbp < 160) sbpIndex = 2;
  else if (sbp < 180) sbpIndex = 3;
  else sbpIndex = 4;

  // Determine BMI Index
  let bmiIndex = 0;
  if (bmi < 20) bmiIndex = 0;
  else if (bmi < 25) bmiIndex = 1;
  else if (bmi < 30) bmiIndex = 2;
  else if (bmi < 35) bmiIndex = 3;
  else bmiIndex = 4;

  try {
    // If patient has diabetes, we use the lab-based chart with median cholesterol (4-4.9 mmol/L -> index 1)
    // as a refined proxy since non-lab Diabetic charts are effectively this in many WHO adaptations.
    if (hasDiabetes) {
      const diabetesKey = 1;
      const labAgeGroup = getLabAgeGroup(age);
      if (!labAgeGroup) return null;
      return riskDataLab[diabetesKey][labAgeGroup][gender][smokingStatus][sbpIndex][1];
    }
    
    return riskData[ageGroup][gender][smokingStatus][sbpIndex][bmiIndex];
  } catch (e) {
    return null;
  }
};

export interface CVRiskLabInputs {
  age: number;
  gender: Gender;
  isSmoker: boolean;
  sbp: number;
  hasDiabetes: boolean;
  totalCholesterol: number; // in mg/dL
}

// WHO Laboratory-based risk chart for South Asia
// Data structure: [HasDiabetes][AgeGroup][Gender][SmokingStatus][SBP_Index][Chol_Index]
// HasDiabetes: 0:No, 1:Yes
// SBP_Index: 0:<120, 1:120-139, 2:140-159, 3:160-179, 4:>=180
// Chol_Index: 0:<4, 1:4-4.9, 2:5-5.9, 3:6-6.9, 4:>=7 (mmol/l)

const riskDataLab: Record<number, Record<string, Record<Gender, Record<SmokingStatus, number[][]>>>> = {
  0: { // Without Diabetes
    '40-44': {
      'Men': {
        'Non-smoker': [[1, 2, 2, 2, 3], [2, 2, 3, 3, 4], [3, 3, 4, 4, 5], [4, 4, 5, 6, 7], [5, 6, 7, 8, 9]],
        'Smoker': [[3, 3, 4, 5, 6], [4, 4, 5, 6, 8], [5, 6, 7, 8, 10], [9, 10, 12, 15, 18], [13, 15, 18, 21, 24]]
      },
      'Women': {
        'Non-smoker': [[1, 1, 1, 2, 2], [1, 1, 2, 2, 2], [2, 2, 2, 3, 3], [3, 3, 3, 4, 4], [4, 4, 4, 5, 6]],
        'Smoker': [[3, 3, 3, 4, 5], [3, 4, 4, 5, 6], [4, 5, 5, 6, 8], [8, 9, 10, 11, 13], [11, 13, 14, 15, 18]]
      }
    },
    '50-54': {
      'Men': {
        'Non-smoker': [[3, 3, 4, 4, 5], [4, 4, 5, 6, 7], [5, 6, 7, 8, 9], [8, 9, 11, 12, 14], [11, 12, 14, 16, 18]],
        'Smoker': [[5, 5, 6, 7, 9], [7, 8, 9, 10, 12], [9, 10, 12, 14, 16], [13, 15, 17, 20, 24], [18, 20, 24, 28, 32]]
      },
      'Women': {
        'Non-smoker': [[2, 3, 3, 3, 3], [3, 3, 4, 4, 5], [4, 4, 5, 5, 6], [5, 5, 6, 6, 7], [6, 7, 7, 8, 9]],
        'Smoker': [[5, 5, 6, 6, 7], [6, 6, 7, 8, 9], [8, 9, 10, 11, 13], [12, 13, 14, 16, 17], [16, 17, 18, 20, 23]]
      }
    },
    '60-64': {
      'Men': {
        'Non-smoker': [[5, 6, 7, 8, 9], [7, 8, 9, 10, 12], [9, 10, 11, 12, 14], [11, 12, 14, 15, 18], [13, 15, 17, 19, 22]],
        'Smoker': [[8, 9, 10, 12, 14], [10, 11, 13, 15, 17], [12, 14, 16, 18, 21], [15, 17, 20, 23, 26], [19, 22, 24, 28, 32]]
      },
      'Women': {
        'Non-smoker': [[5, 5, 5, 6, 6], [6, 6, 7, 7, 8], [7, 8, 8, 9, 9], [8, 8, 9, 10, 11], [11, 11, 12, 13, 14]],
        'Smoker': [[8, 8, 9, 10, 11], [10, 10, 11, 12, 13], [12, 13, 14, 15, 16], [14, 15, 16, 17, 18], [17, 19, 20, 21, 23]]
      }
    },
    '70-74': {
      'Men': {
        'Non-smoker': [[10, 12, 13, 14, 16], [13, 14, 16, 17, 19], [15, 17, 19, 21, 23], [18, 20, 23, 25, 28], [22, 24, 27, 30, 33]],
        'Smoker': [[13, 15, 17, 18, 21], [16, 18, 20, 22, 25], [19, 21, 24, 27, 29], [23, 26, 28, 31, 35], [28, 31, 34, 37, 41]]
      },
      'Women': {
        'Non-smoker': [[9, 10, 10, 11, 11], [11, 12, 12, 13, 13], [13, 14, 14, 15, 16], [15, 16, 17, 18, 19], [18, 19, 20, 21, 22]],
        'Smoker': [[13, 14, 14, 15, 16], [15, 16, 17, 18, 19], [18, 19, 20, 21, 22], [21, 22, 24, 25, 26], [25, 26, 28, 29, 30]]
      }
    }
  },
  1: { // With Diabetes
    '40-44': {
      'Men': {
        'Non-smoker': [[3, 3, 4, 5, 6], [4, 5, 6, 8, 10], [5, 6, 7, 9, 11], [7, 8, 10, 11, 14], [10, 11, 13, 15, 18]],
        'Smoker': [[5, 6, 8, 9, 12], [7, 9, 10, 12, 15], [9, 10, 11, 14, 17], [12, 14, 17, 20, 24], [17, 20, 24, 28, 34]]
      },
      'Women': {
        'Non-smoker': [[3, 3, 3, 4, 4], [3, 4, 4, 5, 6], [5, 5, 6, 7, 7], [6, 7, 8, 9, 10], [8, 9, 10, 11, 13]],
        'Smoker': [[6, 7, 8, 9, 11], [8, 9, 11, 12, 14], [11, 12, 14, 16, 18], [14, 16, 18, 20, 23], [18, 20, 23, 25, 29]]
      }
    },
    '50-54': {
      'Men': {
        'Non-smoker': [[5, 5, 6, 6, 7], [6, 7, 9, 10, 11], [8, 10, 11, 13, 15], [11, 12, 14, 17, 20], [14, 16, 18, 21, 25]],
        'Smoker': [[8, 9, 11, 13, 16], [11, 12, 14, 17, 20], [14, 16, 18, 22, 26], [18, 20, 24, 28, 32], [22, 26, 30, 35, 40]]
      },
      'Women': {
        'Non-smoker': [[5, 5, 6, 6, 7], [6, 6, 7, 8, 9], [7, 8, 9, 10, 11], [10, 10, 11, 13, 14], [12, 13, 14, 16, 17]],
        'Smoker': [[9, 10, 11, 13, 14], [12, 13, 14, 16, 18], [15, 16, 18, 20, 22], [18, 20, 22, 25, 27], [23, 25, 27, 30, 33]]
      }
    },
    '60-64': {
      'Men': {
        'Non-smoker': [[8, 10, 11, 13, 15], [11, 12, 14, 16, 18], [13, 15, 17, 20, 22], [16, 19, 21, 24, 28], [20, 23, 26, 30, 34]],
        'Smoker': [[12, 14, 16, 19, 22], [15, 18, 20, 23, 27], [19, 22, 25, 28, 32], [24, 27, 30, 35, 39], [29, 33, 37, 42, 47]]
      },
      'Women': {
        'Non-smoker': [[8, 9, 9, 10, 11], [10, 11, 12, 13, 14], [12, 13, 14, 15, 16], [15, 16, 17, 18, 20], [18, 19, 21, 22, 24]],
        'Smoker': [[14, 15, 16, 17, 19], [17, 18, 19, 21, 23], [20, 21, 23, 25, 27], [24, 26, 28, 30, 32], [29, 31, 33, 36, 38]]
      }
    },
    '70-74': {
      'Men': {
        'Non-smoker': [[15, 16, 18, 20, 23], [18, 19, 22, 24, 27], [21, 23, 26, 29, 32], [25, 28, 31, 34, 38], [30, 33, 36, 40, 44]],
        'Smoker': [[19, 21, 23, 26, 29], [22, 25, 28, 31, 34], [27, 30, 33, 36, 40], [32, 35, 39, 43, 47], [37, 41, 45, 50, 54]]
      },
      'Women': {
        'Non-smoker': [[14, 15, 16, 16, 17], [18, 19, 19, 20, 20], [20, 21, 22, 23, 24], [23, 24, 25, 27, 28], [27, 28, 29, 31, 33]],
        'Smoker': [[20, 21, 22, 23, 24], [23, 24, 26, 27, 28], [27, 28, 30, 31, 33], [31, 33, 35, 36, 38], [36, 38, 40, 42, 44]]
      }
    }
  }
};

// Interpolation for missing age groups in lab-based data
const getLabAgeGroup = (age: number): string => {
  if (age >= 40 && age <= 44) return '40-44';
  if (age >= 45 && age <= 49) return '40-44'; // Use 40-44 as proxy or interpolate
  if (age >= 50 && age <= 54) return '50-54';
  if (age >= 55 && age <= 59) return '50-54'; // Use 50-54 as proxy
  if (age >= 60 && age <= 64) return '60-64';
  if (age >= 65 && age <= 69) return '60-64'; // Use 60-64 as proxy
  if (age >= 70 && age <= 74) return '70-74';
  return '';
};

export const calculateCVRiskLab = (inputs: CVRiskLabInputs): number | null => {
  const { age, gender, isSmoker, sbp, hasDiabetes, totalCholesterol } = inputs;

  if (isNaN(age) || isNaN(sbp) || isNaN(totalCholesterol)) return null;

  const ageGroup = getLabAgeGroup(age);
  if (!ageGroup) return null;

  const diabetesKey = hasDiabetes ? 1 : 0;
  const smokingStatus: SmokingStatus = isSmoker ? 'Smoker' : 'Non-smoker';

  // Determine SBP Index
  let sbpIndex = 0;
  if (sbp < 120) sbpIndex = 0;
  else if (sbp < 140) sbpIndex = 1;
  else if (sbp < 160) sbpIndex = 2;
  else if (sbp < 180) sbpIndex = 3;
  else sbpIndex = 4;

  // Determine Cholesterol Index (mmol/l)
  // Conversion: mg/dL / 38.67 = mmol/L
  const cholMmol = totalCholesterol / 38.67;
  let cholIndex = 0;
  if (cholMmol < 4) cholIndex = 0;
  else if (cholMmol < 5) cholIndex = 1;
  else if (cholMmol < 6) cholIndex = 2;
  else if (cholMmol < 7) cholIndex = 3;
  else cholIndex = 4;

  try {
    return riskDataLab[diabetesKey][ageGroup][gender][smokingStatus][sbpIndex][cholIndex];
  } catch (e) {
    return null;
  }
};

export const getRiskLevel = (percentage: number) => {
  if (percentage < 5) return { label: '<5%', color: '#84cc16' }; // Green
  if (percentage < 10) return { label: '5% to <10%', color: '#facc15' }; // Yellow
  if (percentage < 20) return { label: '10% to <20%', color: '#f97316' }; // Orange
  if (percentage < 30) return { label: '20% to <30%', color: '#dc2626' }; // Red
  return { label: '>=30%', color: '#7f1d1d' }; // Maroon
};
