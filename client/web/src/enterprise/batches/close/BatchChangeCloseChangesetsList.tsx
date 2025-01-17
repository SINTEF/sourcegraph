import React, { useCallback } from 'react'

import * as H from 'history'
import { repeatWhen, delay } from 'rxjs/operators'

import { ErrorLike } from '@sourcegraph/common'
import { Container } from '@sourcegraph/wildcard'

import { FilteredConnectionQueryArguments, FilteredConnection } from '../../../components/FilteredConnection'
import { Scalars, ChangesetFields, BatchChangeChangesetsResult } from '../../../graphql-operations'
import {
    queryChangesets as _queryChangesets,
    queryExternalChangesetWithFileDiffs as _queryExternalChangesetWithFileDiffs,
} from '../detail/backend'

import {
    BatchChangeCloseHeaderWillCloseChangesets,
    BatchChangeCloseHeaderWillKeepChangesets,
} from './BatchChangeCloseHeader'
import { ChangesetCloseNodeProps, ChangesetCloseNode } from './ChangesetCloseNode'
import { CloseChangesetsListEmptyElement } from './CloseChangesetsListEmptyElement'

import styles from './BatchChangeCloseChangesetsList.module.scss'

interface Props {
    batchChangeID: Scalars['ID']
    viewerCanAdminister: boolean
    history: H.History
    location: H.Location
    willClose: boolean
    onUpdate?: (
        connection?: (BatchChangeChangesetsResult['node'] & { __typename: 'BatchChange' })['changesets'] | ErrorLike
    ) => void

    /** For testing only. */
    queryChangesets?: typeof _queryChangesets
    /** For testing only. */
    queryExternalChangesetWithFileDiffs?: typeof _queryExternalChangesetWithFileDiffs
}

/**
 * A list of a batch change's changesets that may be closed.
 */
export const BatchChangeCloseChangesetsList: React.FunctionComponent<React.PropsWithChildren<Props>> = ({
    batchChangeID,
    viewerCanAdminister,
    history,
    location,
    willClose,
    onUpdate,
    queryChangesets = _queryChangesets,
    queryExternalChangesetWithFileDiffs,
}) => {
    const queryChangesetsConnection = useCallback(
        (args: FilteredConnectionQueryArguments) =>
            queryChangesets({
                state: null,
                onlyClosable: true,
                checkState: null,
                reviewState: null,
                first: args.first ?? null,
                after: args.after ?? null,
                batchChange: batchChangeID,
                onlyPublishedByThisBatchChange: true,
                search: null,
                onlyArchived: false,
            }).pipe(repeatWhen(notifier => notifier.pipe(delay(5000)))),
        [batchChangeID, queryChangesets]
    )

    return (
        <div className="list-group position-relative">
            <Container role="region" aria-label="affected changesets">
                <FilteredConnection<
                    ChangesetFields,
                    Omit<ChangesetCloseNodeProps, 'node'>,
                    {},
                    (BatchChangeChangesetsResult['node'] & { __typename: 'BatchChange' })['changesets']
                >
                    nodeComponent={ChangesetCloseNode}
                    nodeComponentProps={{
                        viewerCanAdminister,
                        history,
                        location,
                        queryExternalChangesetWithFileDiffs,
                        willClose,
                    }}
                    queryConnection={queryChangesetsConnection}
                    hideSearch={true}
                    defaultFirst={15}
                    noun="open changeset"
                    pluralNoun="open changesets"
                    history={history}
                    location={location}
                    useURLQuery={true}
                    listClassName={styles.batchChangeCloseChangesetsListGrid}
                    headComponent={
                        willClose ? BatchChangeCloseHeaderWillCloseChangesets : BatchChangeCloseHeaderWillKeepChangesets
                    }
                    noSummaryIfAllNodesVisible={true}
                    onUpdate={onUpdate}
                    emptyElement={<CloseChangesetsListEmptyElement />}
                    withCenteredSummary={true}
                />
            </Container>
        </div>
    )
}
