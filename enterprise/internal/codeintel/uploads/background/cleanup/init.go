package cleanup

import (
	"github.com/sourcegraph/sourcegraph/internal/goroutine"
)

func NewJanitor(backgroundJobs UploadServiceBackgroundJobs) []goroutine.BackgroundRoutine {
	return []goroutine.BackgroundRoutine{
		backgroundJobs.NewJanitor(
			ConfigInst.Interval,
			ConfigInst.UploadTimeout,
			ConfigInst.AuditLogMaxAge,
			ConfigInst.MinimumTimeSinceLastCheck,
			ConfigInst.CommitResolverBatchSize,
			ConfigInst.CommitResolverMaximumCommitLag,
		),
	}
}

func NewReconciler(backgroundJobs UploadServiceBackgroundJobs) []goroutine.BackgroundRoutine {
	return []goroutine.BackgroundRoutine{
		backgroundJobs.NewReconciler(ConfigInst.Interval, ConfigInst.ReconcilerBatchSize),
	}
}

func NewResetters(backgroundJobs UploadServiceBackgroundJobs) []goroutine.BackgroundRoutine {
	return []goroutine.BackgroundRoutine{
		backgroundJobs.NewUploadResetter(ConfigInst.Interval),
	}
}