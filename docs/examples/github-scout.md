# GitHub Scout

A workflow that fetches a GitHub user profile from the public API and evaluates their popularity and activity level. This example works with real data — no API key needed.

## Full source

```txt
# GitHub Repository Scout
# Takes a GitHub username and returns a profile report
# using the public GitHub API (no auth needed).

config:
    name: "GitHub Repository Scout"
    version: 1

services:
    GitHub is an API at "https://api.github.com"

workflow:
    trigger: when a username is provided

    step FetchProfile:
        log "Looking up GitHub user: {request.username}"
        get profile using GitHub at "/users/{request.username}"
            save the result as profile
        set name to profile.name
        set bio to profile.bio
        set public-repos to profile.public_repos
        set followers to profile.followers
        set following to profile.following
        set created to profile.created_at
        log "Found: {name} — {public-repos} public repos, {followers} followers"

    step EvaluatePopularity:
        if followers is above 1000:
            set popularity to "star"
        otherwise if followers is above 100:
            set popularity to "popular"
        otherwise if followers is above 10:
            set popularity to "growing"
        otherwise:
            set popularity to "newcomer"
        log "Popularity: {popularity}"

    step EvaluateActivity:
        if public-repos is above 50:
            set activity to "very active"
        otherwise if public-repos is above 20:
            set activity to "active"
        otherwise if public-repos is above 5:
            set activity to "moderate"
        otherwise:
            set activity to "just getting started"
        log "Activity level: {activity}"

    complete with name name and bio bio and repos public-repos and followers followers and following following and popularity popularity and activity activity
```

## What this does

1. **Fetches a GitHub profile** using the public API (no authentication needed)
2. **Extracts profile data** — name, bio, repos, followers, etc.
3. **Evaluates popularity** based on follower count (star, popular, growing, newcomer)
4. **Evaluates activity** based on public repository count
5. **Returns a complete report** with all profile data and evaluations

## Concepts demonstrated

- **Real API calls** — works with the live GitHub API
- **URL path building** — `at "/users/{request.username}"`
- **Saving API results** — `save the result as profile`
- **Dot notation for nested data** — `profile.public_repos`
- **Multi-level conditionals** — chained `if` / `otherwise if` / `otherwise`
- **Named steps** — logical grouping of fetch, evaluate, and output

## Running it

This example works with real data — try it with any GitHub username:

```bash
# Look up a specific user
flow run examples/github-scout.flow --input '{"username": "torvalds"}'

# Try another user
flow run examples/github-scout.flow --input '{"username": "octocat"}'
```

Sample output:

```
[LOG] Looking up GitHub user: torvalds
[LOG] Found: Linus Torvalds — 7 public repos, 283103 followers
[LOG] Popularity: star
[LOG] Activity level: moderate

Workflow completed:
  name: "Linus Torvalds"
  bio: ""
  repos: 7
  followers: 283103
  following: 0
  popularity: "star"
  activity: "moderate"
```

## As a webhook

```bash
flow serve examples/github-scout.flow --verbose

curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'
```

Response:

```json
{
    "status": "completed",
    "outputs": {
        "name": "The Octocat",
        "bio": null,
        "repos": 8,
        "followers": 21724,
        "following": 9,
        "popularity": "star",
        "activity": "moderate"
    }
}
```

## Try different users

| Username | Followers | Popularity | Activity |
|---|---|---|---|
| `torvalds` | 283,103 | star | moderate |
| `octocat` | 21,724 | star | moderate |
| `AbrahamOluwa` | 1 | newcomer | moderate |
