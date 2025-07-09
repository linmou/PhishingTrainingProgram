import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Placeholder function - will be implemented in Task 4
export const setUserRole = functions.https.onCall(async (data, context) => {
    // TODO: Implement capacity management logic in Task 4
    // This function will:
    // 1. Check current capacity (1 tutor + 1 student max)
    // 2. Validate user authentication
    // 3. Update user role if capacity allows
    // 4. Return success/failure with capacity status

    throw new functions.https.HttpsError(
        'unimplemented',
        'Capacity management not implemented yet - Task 4'
    );
});

// Placeholder function - will be implemented in Task 4  
export const getCapacityStatus = functions.https.onCall(async (data, context) => {
    // TODO: Implement capacity status check in Task 4
    // This function will:
    // 1. Count active tutors and students
    // 2. Return current capacity status
    // 3. Include availability for new users

    throw new functions.https.HttpsError(
        'unimplemented',
        'Capacity status check not implemented yet - Task 4'
    );
}); 