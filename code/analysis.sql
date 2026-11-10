-- SQLite 语法。users 为全量分层结果；users_recomputed 为剔除后重算结果。
-- name: segment_summary
SELECT
    Segment_Name,
    COUNT(*) AS user_count,
    ROUND(AVG(Total_Spending), 2) AS average_spending,
    ROUND(AVG(Purchase_Frequency), 2) AS average_frequency,
    ROUND(AVG(I_Score), 2) AS average_browsing_score
FROM users
GROUP BY Segment_Name
ORDER BY user_count DESC, Segment_Name;

-- name: top_200_rfm
WITH ranked AS (
    SELECT User_ID, Segment_Name, RFM_Score,
           ROW_NUMBER() OVER (ORDER BY RFM_Score DESC, User_ID) AS ranking
    FROM users
)
SELECT * FROM ranked
WHERE ranking <= 200
ORDER BY ranking;

-- name: eligible_experiment_users
SELECT User_ID, Segment_Name, RFM_Score, I_Score, Final_Score
FROM users_recomputed
WHERE Group_Type = '潜力'
  AND Newsletter_Subscription = 1
ORDER BY Final_Score DESC, User_ID;
