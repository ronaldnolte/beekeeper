// Guest Account Reset Utility
// Call this function when guest user logs out or logs in

import { supabase } from '../../data/supabase';

const GUEST_EMAIL = 'guest@beektools.com';

export async function resetGuestAccount(): Promise<void> {
    try {
        console.log('[GuestReset] Starting guest account reset...');

        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || session.user.email !== GUEST_EMAIL) {
            console.log('[GuestReset] Not a guest user, skipping reset');
            return;
        }

        const guestUserId = session.user.id;

        // Get all apiaries for the guest user
        const { data: apiaries } = await supabase
            .from('apiaries')
            .select('id')
            .eq('user_id', guestUserId);

        const apiaryIds = apiaries?.map(a => a.id) || [];

        if (apiaryIds.length === 0) {
            console.log('[GuestReset] No apiaries found, nothing to reset');
        } else {
            // Get all hives for those apiaries
            const { data: hives } = await supabase
                .from('hives')
                .select('id')
                .in('apiary_id', apiaryIds);

            const hiveIds = hives?.map(h => h.id) || [];

            console.log(`[GuestReset] Deleting data for ${apiaryIds.length} apiaries and ${hiveIds.length} hives...`);

            // Delete in order of dependencies

            // 1. Delete tasks
            if (hiveIds.length > 0) {
                await supabase
                    .from('tasks')
                    .delete()
                    .or(`hive_id.in.(${hiveIds.join(',')}),assigned_user_id.eq.${guestUserId}`);
            }

            // 2. Delete interventions
            if (hiveIds.length > 0) {
                await supabase
                    .from('interventions')
                    .delete()
                    .in('hive_id', hiveIds);
            }

            // 3. Delete hive_snapshots
            if (hiveIds.length > 0) {
                await supabase
                    .from('hive_snapshots')
                    .delete()
                    .in('hive_id', hiveIds);
            }

            // 4. Delete inspections
            if (hiveIds.length > 0) {
                await supabase
                    .from('inspections')
                    .delete()
                    .in('hive_id', hiveIds);
            }

            // 5. Delete hives
            if (apiaryIds.length > 0) {
                await supabase
                    .from('hives')
                    .delete()
                    .in('apiary_id', apiaryIds);
            }

            // 6. Delete weather forecasts
            if (apiaryIds.length > 0) {
                await supabase
                    .from('weather_forecasts')
                    .delete()
                    .in('apiary_id', apiaryIds);
            }

            // 7. Delete apiaries
            await supabase
                .from('apiaries')
                .delete()
                .eq('user_id', guestUserId);

            console.log('[GuestReset] Guest data deleted successfully');
        }

        // Now restore seed data
        await restoreSeedData(guestUserId);

        console.log('[GuestReset] Guest account reset complete!');

    } catch (error) {
        console.error('[GuestReset] Error resetting guest account:', error);
        // Don't throw - we don't want to prevent login/logout if reset fails
    }
}

async function restoreSeedData(guestUserId: string): Promise<void> {
    console.log('[GuestReset] Restoring seed data...');

    const { data: apiary, error: apiaryError } = await supabase
        .from('apiaries')
        .insert({
            user_id: guestUserId,
            name: 'Demo Apiary',
            zip_code: '80202', // Valid Zip Code (Denver, CO) so Forecast APIs work!
            notes: 'This is a demo apiary for testing. Feel free to explore!'
        })
        .select()
        .single();

    if (apiaryError) {
        console.error('[GuestReset] Error creating seed apiary:', apiaryError);
        return;
    }

    // Create a demo hive
    const { data: hive, error: hiveError } = await supabase
        .from('hives')
        .insert({
            apiary_id: apiary.id,
            name: 'Demo Hive #1',
            bar_count: 24,
            notes: 'Example hive for demonstration purposes'
        })
        .select()
        .single();

    if (hiveError) {
        console.error('[GuestReset] Error creating seed hive:', hiveError);
        return;
    }

    // Create a demo inspection
    await supabase
        .from('inspections')
        .insert({
            hive_id: hive.id,
            inspection_date: new Date().toISOString(),
            brood_pattern: 'good',
            honey_stores: 'adequate',
            pollen_presence: 'good',
            queen_seen: true,
            queen_cells: false,
            swarm_cells: false,
            temperament: 'calm',
            notes: 'Healthy hive, queen active, good brood pattern observed.'
        });

    // Create a demo task
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);

    await supabase
        .from('tasks')
        .insert({
            hive_id: hive.id,
            apiary_id: apiary.id,
            assigned_user_id: guestUserId,
            description: 'Check honey stores and add super if needed',
            due_date: tomorrow.toISOString().split('T')[0],
            completed: false
        });

    console.log('[GuestReset] Seed data restored successfully');
}

// Helper function to check if current user is guest
export async function isGuestUser(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email === GUEST_EMAIL;
}
