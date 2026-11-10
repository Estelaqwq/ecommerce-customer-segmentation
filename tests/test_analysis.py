"""检查可能影响结论的边界、口径和关键结果。"""
from pathlib import Path
import sys
import unittest

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.analysis import (
    load_data, score_users, segment_users, scale_100,
    estimate_profit, experiment_sample_size,
)


class AnalysisChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = load_data()
        cls.full = segment_users(score_users(cls.raw))
        cls.clean = segment_users(score_users(cls.raw.loc[~cls.full.Needs_Review].copy()))

    def test_dataset_and_matched_sensitivity(self):
        self.assertEqual(self.raw.shape, (1000, 14))
        self.assertEqual(int(self.full.Needs_Review.sum()), 85)
        self.assertEqual(len(self.clean), 915)
        before = self.full.set_index('User_ID').User_Segment
        after = self.clean.set_index('User_ID').User_Segment
        self.assertEqual(int((before.loc[after.index] != after).sum()), 43)
        self.assertEqual(self.full.Group_Type.value_counts().to_dict(), {'其他':841,'潜力':89,'核心':70})
        self.assertEqual(self.clean.Group_Type.value_counts().to_dict(), {'其他':764,'潜力':81,'核心':70})
        self.assertEqual(int((self.clean.Group_Type.eq('潜力') & self.clean.Newsletter_Subscription).sum()), 40)

    def test_constant_normalization_keeps_noncontinuous_index(self):
        values = pd.Series([7, 7, 7], index=[3, 8, 20])
        expected = pd.Series([50., 50., 50.], index=[3, 8, 20])
        pd.testing.assert_series_equal(scale_100(values), expected)
        pd.testing.assert_series_equal(scale_100(values, reverse=True), expected)
        result = scale_100(pd.Series([1,15,29]), reverse=True)
        self.assertEqual(result.tolist(), [100.,50.,0.])

    def test_weight_changes_ranking_not_labels(self):
        changed = segment_users(score_users(self.raw, weight=.3))
        self.assertTrue((self.full.User_Segment == changed.User_Segment).all())
        base = self.full.sort_values(['RFM_Score','User_ID'], ascending=[False,True]).head(200)
        weighted = self.full.sort_values(['Final_Score','User_ID'], ascending=[False,True]).head(200)
        self.assertEqual(len(set(weighted.User_ID)-set(base.User_ID)),18)

    def test_coupon_cost_includes_natural_buyers(self):
        result = estimate_profit(100,.1,.1,100,.4,10,.5)
        self.assertEqual(result['预计增量毛利'],0)
        self.assertEqual(result['预计优惠成本'],100)
        self.assertEqual(result['预计增量净收益'],-150)

    def test_scenario_signs_and_zero_cost(self):
        low = estimate_profit(89,.01,.02,104.039,.4,10,.5)
        high = estimate_profit(89,.01,.20,104.039,.4,10,.5)
        self.assertAlmostEqual(low['预计增量净收益'],-25.262116,places=6)
        self.assertAlmostEqual(high['预计增量净收益'],481.219796,places=6)
        self.assertTrue(pd.isna(estimate_profit(89,.01,.05,104.039,.4,0,0)['ROI']))
        with self.assertRaises(ValueError):
            estimate_profit(89,.01,1.2,104.039,.4,10,.5)

    def test_sample_size_and_sql_results(self):
        self.assertEqual(experiment_sample_size(),2320)
        selected = pd.read_csv(ROOT/'outputs/sql/top_200_rfm.csv')
        candidates = pd.read_csv(ROOT/'outputs/sql/eligible_experiment_users.csv')
        self.assertEqual(selected.User_ID.nunique(),200)
        self.assertEqual(candidates.User_ID.nunique(),40)
        expected = self.clean.loc[self.clean.Group_Type.eq('潜力') & self.clean.Newsletter_Subscription,'User_ID']
        self.assertEqual(set(candidates.User_ID),set(expected))


if __name__ == '__main__':
    unittest.main()
