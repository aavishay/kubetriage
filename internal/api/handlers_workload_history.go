package api

import (
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
)

// WorkloadMetricsHistoryHandler returns the recent metric snapshots recorded for a workload.
// These snapshots are populated from the Kubernetes Metrics API on each workload refresh,
// so right-sizing charts can show real demand without requiring a separate Prometheus.
func WorkloadMetricsHistoryHandler(c *gin.Context) {
	clusterID := c.Query("cluster")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if db.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database not initialized"})
		return
	}

	var snapshots []db.WorkloadMetricSnapshot
	if err := db.DB.WithContext(c.Request.Context()).
		Where("cluster_id = ? AND namespace = ? AND workload_name = ?", clusterID, namespace, name).
		Order("recorded_at ASC").
		Limit(120).
		Find(&snapshots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"points": snapshots})
}
