package codeintel

import (
	"context"

	"github.com/sourcegraph/sourcegraph/cmd/worker/job"
	workerdb "github.com/sourcegraph/sourcegraph/cmd/worker/shared/init/db"
	"github.com/sourcegraph/sourcegraph/internal/codeintel/dependencies"
	"github.com/sourcegraph/sourcegraph/internal/env"
	"github.com/sourcegraph/sourcegraph/internal/gitserver"
	"github.com/sourcegraph/sourcegraph/internal/goroutine"
	"github.com/sourcegraph/sourcegraph/internal/observation"
)

type cratesSyncerJob struct{}

func NewCratesSyncerJob() job.Job {
	return &cratesSyncerJob{}
}

func (j *cratesSyncerJob) Description() string {
	return "crates.io syncer"
}

func (j *cratesSyncerJob) Config() []env.Config {
	return nil
}

func (j *cratesSyncerJob) Routines(startupCtx context.Context, observationCtx *observation.Context) ([]goroutine.BackgroundRoutine, error) {
	db, err := workerdb.InitDB(observationCtx)
	if err != nil {
		return nil, err
	}

	gitserverClient := gitserver.NewClient(db)
	dependenciesService := dependencies.NewService(observationCtx, db)

	return dependencies.CrateSyncerJob(
		observationCtx,
		dependenciesService,
		gitserverClient,
		db.ExternalServices(),
	), nil
}
