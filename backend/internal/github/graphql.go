package github

import (
	"context"
	"fmt"
	"time"

	"github.com/shurcooL/githubv4"
)

// EnrichRepositories fills stale PR/issue counts and latest release via GitHub GraphQL.
// Best-effort: logs and returns nil on failure so REST repo list still works.
func (c *Client) EnrichRepositories(ctx context.Context, org string, repos []Repository) error {
	if c.gql == nil || len(repos) == 0 {
		return nil
	}

	byName := make(map[string]*Repository, len(repos))
	for i := range repos {
		byName[repos[i].Name] = &repos[i]
	}

	staleCutoff := time.Now().UTC().AddDate(0, 0, -StaleActivityDays)
	var cursor *githubv4.String

	for {
		var q struct {
			Organization struct {
				Repositories struct {
					Nodes []struct {
						Name          string
						PullRequests  pullRequestConnection `graphql:"pullRequests(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: ASC})"`
						Issues        issueConnection       `graphql:"issues(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: ASC})"`
						LatestRelease *struct {
							PublishedAt githubv4.DateTime
							TagName     string
							URL         string `graphql:"url"`
						}
					}
					PageInfo struct {
						EndCursor   githubv4.String
						HasNextPage bool
					}
				} `graphql:"repositories(first: 50, after: $cursor, orderBy: {field: NAME, direction: ASC})"`
			} `graphql:"organization(login: $org)"`
		}

		variables := map[string]interface{}{
			"org":    githubv4.String(org),
			"cursor": cursor,
		}
		if err := c.gql.Query(ctx, &q, variables); err != nil {
			return fmt.Errorf("graphql org repositories: %w", err)
		}

		for _, node := range q.Organization.Repositories.Nodes {
			repo, ok := byName[node.Name]
			if !ok {
				continue
			}
			repo.StalePullRequests = countStale(node.PullRequests.Nodes, staleCutoff)
			repo.StaleIssues = countStale(node.Issues.Nodes, staleCutoff)
			if node.LatestRelease != nil && !node.LatestRelease.PublishedAt.IsZero() {
				repo.LastReleaseAt = node.LatestRelease.PublishedAt.Format(time.RFC3339)
				repo.LastReleaseTag = node.LatestRelease.TagName
				repo.LastReleaseURL = node.LatestRelease.URL
			}
			if node.PullRequests.TotalCount > 0 && repo.OpenPullRequests == 0 {
				repo.OpenPullRequests = node.PullRequests.TotalCount
			}
		}

		if !q.Organization.Repositories.PageInfo.HasNextPage {
			break
		}
		cursor = &q.Organization.Repositories.PageInfo.EndCursor
	}

	return nil
}

type pullRequestConnection struct {
	TotalCount int
	Nodes      []struct {
		UpdatedAt githubv4.DateTime
	}
}

type issueConnection struct {
	TotalCount int
	Nodes      []struct {
		UpdatedAt githubv4.DateTime
	}
}

func countStale(nodes []struct {
	UpdatedAt githubv4.DateTime
}, cutoff time.Time) int {
	n := 0
	for _, node := range nodes {
		if node.UpdatedAt.Time.Before(cutoff) {
			n++
		}
	}
	return n
}
