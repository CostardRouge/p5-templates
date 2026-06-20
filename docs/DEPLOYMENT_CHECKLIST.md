# Server-Side Frame Capture - Deployment Checklist

## Pre-Deployment

### Code Review
- [x] Review `src/utils/captureFramesServerSide.ts`
- [x] Review `src/utils/captureFramesWithStreaming.ts`
- [x] Review `src/lib/recordSketch.ts` changes
- [x] Review `src/lib/recordSketchSlides.ts` changes
- [x] Verify no TypeScript errors
- [x] Verify no ESLint warnings

### Testing

#### Unit Tests
- [ ] Test `captureFramesServerSide()` with valid inputs
- [ ] Test `captureFramesServerSide()` with invalid inputs
- [ ] Test error handling (canvas not found)
- [ ] Test error handling (disk write failure)
- [ ] Test progress callback functionality

#### Integration Tests
- [ ] Run `node scripts/test-frame-capture.mjs`
- [ ] Verify test passes with 60 frames
- [ ] Test with 300 frames (5 seconds)
- [ ] Test with 600 frames (10 seconds)
- [ ] Test with different resolutions (720p, 1080p)

#### End-to-End Tests
- [ ] Create single sketch recording via API
- [ ] Verify video is generated correctly
- [ ] Verify thumbnail is generated
- [ ] Verify S3 upload works
- [ ] Create multi-slide recording
- [ ] Verify all slides are recorded
- [ ] Verify progress tracking works

### Performance Validation

#### Memory Usage
- [ ] Monitor memory during 300-frame capture
- [ ] Verify memory stays under 100MB
- [ ] Check for memory leaks (run multiple recordings)
- [ ] Compare with old tar-based method

#### Processing Time
- [ ] Measure time for 300-frame capture
- [ ] Verify 30-40% improvement over old method
- [ ] Test with different framerates (30, 60, 120 fps)

#### Stability
- [ ] Test with 1000+ frame videos
- [ ] Verify no browser crashes
- [ ] Test concurrent recordings (if applicable)
- [ ] Test error recovery

### Documentation
- [x] Create `FRAME_CAPTURE_MIGRATION.md`
- [x] Create `SERVER_SIDE_CAPTURE_GUIDE.md`
- [x] Create `MIGRATION_SUMMARY.md`
- [x] Create `DEPLOYMENT_CHECKLIST.md`
- [x] Create `scripts/test-frame-capture.mjs`
- [x] Update `scripts/README.md`
- [ ] Update main `README.md` (if needed)
- [ ] Update API documentation (if needed)

## Deployment

### Staging Environment

#### Pre-Deploy
- [ ] Backup current production code
- [ ] Document rollback procedure
- [ ] Notify team of deployment

#### Deploy
- [ ] Deploy to staging
- [ ] Verify deployment successful
- [ ] Check logs for errors
- [ ] Run smoke tests

#### Validation
- [ ] Test single recording on staging
- [ ] Test multi-slide recording on staging
- [ ] Monitor memory usage
- [ ] Monitor processing time
- [ ] Check S3 uploads
- [ ] Verify thumbnails

#### Monitoring
- [ ] Set up memory usage alerts
- [ ] Set up error rate alerts
- [ ] Monitor disk space usage
- [ ] Monitor FFmpeg process health

### Production Environment

#### Pre-Deploy
- [ ] Review staging test results
- [ ] Get approval from team
- [ ] Schedule deployment window
- [ ] Notify users of maintenance (if needed)

#### Deploy
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Check logs for errors
- [ ] Run smoke tests

#### Validation
- [ ] Test single recording on production
- [ ] Test multi-slide recording on production
- [ ] Monitor memory usage
- [ ] Monitor processing time
- [ ] Check S3 uploads
- [ ] Verify thumbnails

#### Monitoring
- [ ] Monitor error rates (first 24 hours)
- [ ] Monitor memory usage (first 24 hours)
- [ ] Monitor processing times (first 24 hours)
- [ ] Monitor disk space (first 24 hours)
- [ ] Check user feedback

## Post-Deployment

### Immediate (First 24 Hours)

#### Monitoring
- [ ] Check error logs every 2 hours
- [ ] Monitor memory usage trends
- [ ] Monitor processing time trends
- [ ] Check disk space usage
- [ ] Verify S3 uploads working

#### Metrics
- [ ] Record baseline memory usage
- [ ] Record baseline processing times
- [ ] Record error rates
- [ ] Compare with pre-migration metrics

#### User Feedback
- [ ] Monitor support tickets
- [ ] Check for user complaints
- [ ] Gather feedback on performance
- [ ] Document any issues

### Short-Term (First Week)

#### Performance Analysis
- [ ] Analyze memory usage patterns
- [ ] Analyze processing time patterns
- [ ] Identify any bottlenecks
- [ ] Compare with old method

#### Optimization
- [ ] Identify optimization opportunities
- [ ] Adjust frame capture delay (if needed)
- [ ] Optimize FFmpeg settings (if needed)

#### Documentation
- [ ] Update documentation based on findings
- [ ] Document any issues encountered
- [ ] Document solutions implemented
- [ ] Share learnings with team

### Long-Term (First Month)

#### Stability
- [ ] Verify no memory leaks
- [ ] Verify no disk space issues
- [ ] Verify consistent performance
- [ ] Check for edge cases

#### Optimization
- [ ] Consider parallel frame capture
- [ ] Consider GPU acceleration
- [ ] Consider resume capability

#### Cleanup
- [ ] Remove old tar-based code (if confirmed stable)
- [ ] Remove unused dependencies
- [ ] Clean up browser-side libraries
- [ ] Archive old documentation

## Rollback Plan

### If Issues Arise

#### Immediate Actions
1. Stop new recordings
2. Assess severity of issue
3. Check logs for root cause
4. Decide: fix forward or rollback

#### Rollback Procedure
1. **Restore previous code:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Redeploy previous version:**
   ```bash
   npm run build
   npm run deploy
   ```

3. **Verify rollback:**
   - Test single recording
   - Test multi-slide recording
   - Check logs for errors

4. **Notify team:**
   - Inform team of rollback
   - Document reason for rollback
   - Plan fix and re-deployment

#### Files to Restore
- `src/lib/recordSketch.ts`
- `src/lib/recordSketchSlides.ts`

#### Dependencies to Restore
- Re-add tar import: `import * as tar from "tar"`
- Re-add browser-side recording trigger

## Success Criteria

### Performance
- ✅ Memory usage reduced by 80%+
- ✅ Processing time reduced by 25%+
- ✅ No crashes on 1000+ frame videos
- ✅ Consistent performance across resolutions

### Stability
- ✅ Error rate < 1%
- ✅ No memory leaks
- ✅ No disk space issues
- ✅ Successful S3 uploads

### User Experience
- ✅ Faster video generation
- ✅ No user-facing errors
- ✅ Accurate progress tracking
- ✅ High-quality output

## Sign-Off

### Development Team
- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Documentation complete

### QA Team
- [ ] Integration tests passing
- [ ] Performance validated
- [ ] Edge cases tested

### DevOps Team
- [ ] Deployment plan reviewed
- [ ] Monitoring configured
- [ ] Rollback plan tested

### Product Team
- [ ] User impact assessed
- [ ] Success criteria defined
- [ ] Deployment approved

## Notes

### Known Limitations
- Frame capture requires canvas to be fully loaded
- Disk space required for temporary frames
- FFmpeg must be installed on server

### Future Enhancements
- Parallel frame capture
- GPU-accelerated encoding
- Resume capability for interrupted recordings

### Contact
For issues or questions:
- Check documentation in `FRAME_CAPTURE_MIGRATION.md`
- Review troubleshooting in `SERVER_SIDE_CAPTURE_GUIDE.md`
- Contact development team

---

**Last Updated:** [Date]  
**Migration Version:** 1.0.0  
**Status:** Ready for Deployment
