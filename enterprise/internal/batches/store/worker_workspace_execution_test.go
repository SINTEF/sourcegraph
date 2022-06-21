	"sync"
	logger := logtest.Scoped(t)
	db := database.NewDB(logger, dbtest.NewDB(logger, t))
		Store:              workStore,
		observationContext: &observation.TestContext,
		logger:             logtest.Scoped(t),
			var cachedExecutionResult *execution.AfterStepResult
	logger := logtest.Scoped(t)
	db := database.NewDB(logger, dbtest.NewDB(logger, t))
		Store:              workStore,
		observationContext: &observation.TestContext,
		logger:             logtest.Scoped(t),
			var cachedExecutionResult *execution.AfterStepResult
	logger := logtest.Scoped(t)
	db := database.NewDB(logger, dbtest.NewDB(logger, t))
	cacheEntryKeys := []string{"JkC7Q0OOCZZ3Acv79QfwSA-step-0"}
	executionStore := &batchSpecWorkspaceExecutionWorkerStore{
		Store:              workStore,
		observationContext: &observation.TestContext,
	opts := dbworkerstore.MarkFinalOptions{WorkerHostname: "worker-1"}
	logger := logtest.Scoped(t)
	db := database.NewDB(logger, dbtest.NewDB(logger, t))
	user1 := ct.CreateTestUser(t, db, true)
	user2 := ct.CreateTestUser(t, db, true)
	user3 := ct.CreateTestUser(t, db, true)

	user1BatchSpec := setupUserBatchSpec(t, ctx, s, user1)
	user2BatchSpec := setupUserBatchSpec(t, ctx, s, user2)
	user3BatchSpec := setupUserBatchSpec(t, ctx, s, user3)

	job1 := setupBatchSpecAssociation(ctx, s, t, user1BatchSpec, repo) // User_ID: 1
	job2 := setupBatchSpecAssociation(ctx, s, t, user1BatchSpec, repo) // User_ID: 1
	job3 := setupBatchSpecAssociation(ctx, s, t, user2BatchSpec, repo) // User_ID: 2
	job4 := setupBatchSpecAssociation(ctx, s, t, user2BatchSpec, repo) // User_ID: 2
	job5 := setupBatchSpecAssociation(ctx, s, t, user3BatchSpec, repo) // User_ID: 3
	job6 := setupBatchSpecAssociation(ctx, s, t, user3BatchSpec, repo) // User_ID: 3
		r, found, err := workerStore.Dequeue(ctx, "test-worker", nil)
		if err != nil {
			t.Fatal(err)
		}
func TestBatchSpecWorkspaceExecutionWorkerStore_Dequeue_RoundRobin_NoDoubleDequeue(t *testing.T) {
	logger := logtest.Scoped(t)
	ctx := context.Background()
	db := database.NewDB(logger, dbtest.NewDB(logger, t))

	repo, _ := ct.CreateTestRepo(t, ctx, db)

	s := New(db, &observation.TestContext, nil)
	workerStore := dbworkerstore.NewWithMetrics(s.Handle(), batchSpecWorkspaceExecutionWorkerStoreOptions, &observation.TestContext)

	user1 := ct.CreateTestUser(t, db, true)
	user2 := ct.CreateTestUser(t, db, true)
	user3 := ct.CreateTestUser(t, db, true)

	user1BatchSpec := setupUserBatchSpec(t, ctx, s, user1)
	user2BatchSpec := setupUserBatchSpec(t, ctx, s, user2)
	user3BatchSpec := setupUserBatchSpec(t, ctx, s, user3)

	// We create multiple jobs for each user because this test ensures jobs are
	// dequeued in a round-robin fashion, starting with the user who dequeued
	// the longest ago.
	for i := 0; i < 100; i++ {
		setupBatchSpecAssociation(ctx, s, t, user1BatchSpec, repo)
		setupBatchSpecAssociation(ctx, s, t, user2BatchSpec, repo)
		setupBatchSpecAssociation(ctx, s, t, user3BatchSpec, repo)
	}

	have := []int64{}
	var haveLock sync.Mutex

	errs := make(chan error)

	// We dequeue records until there are no more left. We spawn 8 concurrent
	// "workers" to find potential locking issues.
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			for {
				r, found, err := workerStore.Dequeue(ctx, "test-worker", nil)
				if err != nil {
					errs <- err
				}
				if !found {
					break
				}
				haveLock.Lock()
				have = append(have, int64(r.RecordID()))
				haveLock.Unlock()
			}
		}()
	}
	var multiErr error
	errDone := make(chan struct{})
	go func() {
		for err := range errs {
			multiErr = errors.Append(multiErr, err)
		}
		close(errDone)
	}()

	wg.Wait()
	close(errs)
	<-errDone

	if multiErr != nil {
		t.Fatal(multiErr)
	}

	// Check for duplicates.
	seen := make(map[int64]struct{})
	for _, h := range have {
		if _, ok := seen[h]; ok {
			t.Fatal("duplicate dequeue")
		}
		seen[h] = struct{}{}
	}
}

func setupUserBatchSpec(t *testing.T, ctx context.Context, s *Store, user *types.User) *btypes.BatchSpec {
	t.Helper()
	bs := &btypes.BatchSpec{UserID: user.ID, NamespaceUserID: user.ID, RawSpec: "horse", Spec: &batcheslib.BatchSpec{
	if err := s.CreateBatchSpec(ctx, bs); err != nil {
	return bs
}
func setupBatchSpecAssociation(ctx context.Context, s *Store, t *testing.T, batchSpec *btypes.BatchSpec, repo *types.Repo) int64 {
	job := &btypes.BatchSpecWorkspaceExecutionJob{BatchSpecWorkspaceID: workspace.ID, UserID: batchSpec.UserID}