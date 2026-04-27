// Loaded by .github/actions/post-pr-comment/action.yml via actions/github-script.
//
// Required env vars:
//   COMMENT_BODY     Comment body (already resolved from `body` or `file`)
//   COMMENT_MARKER   HTML comment marker for in-place updates
//   INPUT_PR_NUMBER  Optional explicit PR number (defaults to context)

module.exports = async ({ github, context }) => {
  const marker = `<!-- ${process.env.COMMENT_MARKER} -->`;
  const body = `${marker}\n${process.env.COMMENT_BODY}`;

  const inputPr = process.env.INPUT_PR_NUMBER;
  const prNumber = inputPr ? parseInt(inputPr, 10) : context.issue.number;

  if (!prNumber) {
    console.log('No PR number found, skipping comment');
    return;
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });

  const existingComment = comments.find(
    (comment) => comment.body && comment.body.includes(marker),
  );

  if (existingComment) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body,
    });
    console.log(`Updated comment ${existingComment.id}`);
  } else {
    const { data: newComment } = await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });
    console.log(`Created comment ${newComment.id}`);
  }
};
