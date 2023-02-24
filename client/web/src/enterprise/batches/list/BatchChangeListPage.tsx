import React, { useEffect, useCallback, useState, useMemo } from 'react'

import classNames from 'classnames'
import { useLocation } from 'react-router-dom-v5-compat'

import { pluralize } from '@sourcegraph/common'
import { dataOrThrowErrors, useQuery } from '@sourcegraph/http-client'
import { Settings } from '@sourcegraph/shared/src/schema/settings.schema'
import { SettingsCascadeProps } from '@sourcegraph/shared/src/settings/settings'
import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { buildCloudTrialURL } from '@sourcegraph/shared/src/util/url'
import { Button, PageHeader, Link, Container, H3, Text, screenReaderAnnounce } from '@sourcegraph/wildcard'

import { AuthenticatedUser } from '../../../auth'
import { isBatchChangesExecutionEnabled } from '../../../batches'
import { BatchChangesIcon } from '../../../batches/icons'
import { useShowMorePagination } from '../../../components/FilteredConnection/hooks/useShowMorePagination'
import {
    ConnectionContainer,
    ConnectionError,
    ConnectionList,
    ConnectionLoading,
    ConnectionSummary,
    ShowMoreButton,
    SummaryContainer,
} from '../../../components/FilteredConnection/ui'
import { Page } from '../../../components/Page'
import {
    ListBatchChange,
    Scalars,
    BatchChangesVariables,
    BatchChangesResult,
    BatchChangesByNamespaceResult,
    BatchChangesByNamespaceVariables,
    GetLicenseAndUsageInfoResult,
    GetLicenseAndUsageInfoVariables,
} from '../../../graphql-operations'
import { eventLogger } from '../../../tracking/eventLogger'

import { BATCH_CHANGES, BATCH_CHANGES_BY_NAMESPACE, GET_LICENSE_AND_USAGE_INFO } from './backend'
import { BatchChangeListFilters } from './BatchChangeListFilters'
import { BatchChangeNode } from './BatchChangeNode'
import { BatchChangesListIntro } from './BatchChangesListIntro'
import { BatchChangeStatsBar } from './BatchChangeStatsBar'
import { GettingStarted } from './GettingStarted'
import { NewBatchChangeButton } from './NewBatchChangeButton'
import { useBatchChangeListFilters } from './useBatchChangeListFilters'

import styles from './BatchChangeListPage.module.scss'

export interface BatchChangeListPageProps extends TelemetryProps, SettingsCascadeProps<Settings> {
    canCreate: boolean
    headingElement: 'h1' | 'h2'
    namespaceID?: Scalars['ID']
    isSourcegraphDotCom: boolean
    authenticatedUser: AuthenticatedUser | null
    /** For testing only. */
    openTab?: SelectedTab
}

type SelectedTab = 'batchChanges' | 'gettingStarted'

const BATCH_CHANGES_PER_PAGE_COUNT = 15

/**
 * A list of all batch changes on the Sourcegraph instance.
 */
export const BatchChangeListPage: React.FunctionComponent<React.PropsWithChildren<BatchChangeListPageProps>> = ({
    canCreate,
    namespaceID,
    headingElement,
    openTab,
    settingsCascade,
    telemetryService,
    isSourcegraphDotCom,
    authenticatedUser,
}) => {
    const location = useLocation()
    useEffect(() => telemetryService.logViewEvent('BatchChangesListPage'), [telemetryService])

    const isExecutionEnabled = isBatchChangesExecutionEnabled(settingsCascade)

    const { selectedFilters, setSelectedFilters, availableFilters } = useBatchChangeListFilters({ isExecutionEnabled })
    const [selectedTab, setSelectedTab] = useState<SelectedTab>(
        openTab ?? (isSourcegraphDotCom ? 'gettingStarted' : 'batchChanges')
    )

    // We keep state to track to the last total count of batch changes in the connection
    // to avoid the display flickering as the connection is loading more data or a
    // different set of filtered data.
    const [lastTotalCount, setLastTotalCount] = useState<number>()

    // We use the license and usage query to check whether or not there are any batch
    // changes _at all_. If there aren't, we automatically switch the user to the "Getting
    // started" tab.
    const onUsageCheckCompleted = useCallback(
        (data: GetLicenseAndUsageInfoResult) => {
            if (!openTab && data.allBatchChanges.totalCount === 0) {
                setSelectedTab('gettingStarted')
            }
        },
        [openTab]
    )

    const { data: licenseAndUsageInfo } = useQuery<GetLicenseAndUsageInfoResult, GetLicenseAndUsageInfoVariables>(
        GET_LICENSE_AND_USAGE_INFO,
        { onCompleted: onUsageCheckCompleted }
    )

    const { connection, error, loading, fetchMore, hasNextPage } = useShowMorePagination<
        BatchChangesByNamespaceResult | BatchChangesResult,
        BatchChangesByNamespaceVariables | BatchChangesVariables,
        ListBatchChange
    >({
        query: namespaceID ? BATCH_CHANGES_BY_NAMESPACE : BATCH_CHANGES,
        variables: {
            namespaceID,
            states: selectedFilters,
            first: BATCH_CHANGES_PER_PAGE_COUNT,
            after: null,
            viewerCanAdminister: null,
        },
        options: { useURL: true },
        getConnection: result => {
            const data = dataOrThrowErrors(result)
            if (!namespaceID) {
                return (data as BatchChangesResult).batchChanges
            }
            if (!('node' in data) || !data.node) {
                throw new Error('Namespace not found')
            }
            if (data.node.__typename !== 'Org' && data.node.__typename !== 'User') {
                throw new Error(`Requested node is a ${data.node.__typename}, not a User or Org`)
            }

            return data.node.batchChanges
        },
    })

    useEffect(() => {
        // If the data in the connection updates with new results, update the total count.
        if (typeof connection?.totalCount === 'number') {
            setLastTotalCount(connection.totalCount)
            screenReaderAnnounce(`${connection.totalCount} batch changes`)
        }
    }, [connection])

    const currentTotalCount = licenseAndUsageInfo?.allBatchChanges.totalCount

    return (
        <Page>
            <PageHeader
                className="test-batches-list-page mb-3"
                actions={
                    canCreate ? (
                        <NewBatchChangeButton to={`${location.pathname}/create`} />
                    ) : (
                        <Button
                            as={Link}
                            to={buildCloudTrialURL(authenticatedUser, 'batch')}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="primary"
                            onClick={() => eventLogger.log('ClickedOnCloudCTA', { cloudCtaType: 'TryBatchChanges' })}
                        >
                            Try Batch Changes
                        </Button>
                    )
                }
                headingElement={headingElement}
                description="Run custom code over hundreds of repositories and manage the resulting changesets."
            >
                <PageHeader.Heading as="h2" styleAs="h1">
                    <PageHeader.Breadcrumb icon={BatchChangesIcon}>Batch Changes</PageHeader.Breadcrumb>
                </PageHeader.Heading>
            </PageHeader>
            <BatchChangesListIntro isLicensed={licenseAndUsageInfo?.batchChanges || licenseAndUsageInfo?.campaigns} />
            <BatchChangeListTabHeader
                selectedTab={selectedTab}
                setSelectedTab={setSelectedTab}
                isSourcegraphDotCom={isSourcegraphDotCom}
            />
            {selectedTab === 'gettingStarted' && (
                <GettingStarted
                    isSourcegraphDotCom={isSourcegraphDotCom}
                    authenticatedUser={authenticatedUser}
                    className="mb-4"
                />
            )}
            {selectedTab === 'batchChanges' && (
                <>
                    {!namespaceID && <BatchChangeStatsBar className="mb-4" />}
                    <Container className="mb-4">
                        <ConnectionContainer>
                            <div className={styles.filtersRow}>
                                {typeof currentTotalCount === 'number' && typeof lastTotalCount === 'number' && (
                                    <H3 className="align-self-end flex-1">
                                        {`${lastTotalCount} of ${currentTotalCount} ${pluralize(
                                            'batch change',
                                            currentTotalCount
                                        )}`}
                                    </H3>
                                )}

                                <BatchChangeListFilters
                                    filters={availableFilters}
                                    selectedFilters={selectedFilters}
                                    onFiltersChange={setSelectedFilters}
                                    className="m-0"
                                />
                            </div>
                            {error && <ConnectionError errors={[error.message]} />}
                            <ConnectionList
                                className={classNames(styles.grid, isExecutionEnabled ? styles.wide : styles.narrow)}
                                aria-label="batch changes"
                            >
                                {connection?.nodes?.map(node => (
                                    <BatchChangeNode
                                        key={node.id}
                                        node={node}
                                        isExecutionEnabled={isExecutionEnabled}
                                        // Show the namespace unless we're viewing batch changes for a single namespace.
                                        displayNamespace={!namespaceID}
                                    />
                                ))}
                            </ConnectionList>
                            {loading && <ConnectionLoading />}
                            {connection && (
                                <SummaryContainer centered={true}>
                                    <ConnectionSummary
                                        centered={true}
                                        noSummaryIfAllNodesVisible={true}
                                        first={BATCH_CHANGES_PER_PAGE_COUNT}
                                        connection={connection}
                                        noun="batch change"
                                        pluralNoun="batch changes"
                                        hasNextPage={hasNextPage}
                                        emptyElement={<BatchChangeListEmptyElement canCreate={canCreate} />}
                                    />
                                    {hasNextPage && <ShowMoreButton centered={true} onClick={fetchMore} />}
                                </SummaryContainer>
                            )}
                        </ConnectionContainer>
                    </Container>
                </>
            )}
        </Page>
    )
}

export interface NamespaceBatchChangeListPageProps extends Omit<BatchChangeListPageProps, 'canCreate'> {
    authenticatedUser: AuthenticatedUser
    namespaceID: Scalars['ID']
}

/**
 * A list of all batch changes in a namespace.
 */
export const NamespaceBatchChangeListPage: React.FunctionComponent<
    React.PropsWithChildren<NamespaceBatchChangeListPageProps>
> = ({ authenticatedUser, namespaceID, ...props }) => {
    // A user should only see the button to create a batch change in a namespace if it is
    // their namespace (user namespace), or they belong to it (organization namespace)
    const canCreateInThisNamespace = useMemo(
        () =>
            authenticatedUser.id === namespaceID ||
            authenticatedUser.organizations.nodes.map(org => org.id).includes(namespaceID),
        [authenticatedUser, namespaceID]
    )

    return (
        <BatchChangeListPage
            {...props}
            canCreate={canCreateInThisNamespace}
            namespaceID={namespaceID}
            authenticatedUser={authenticatedUser}
        />
    )
}

interface BatchChangeListEmptyElementProps extends Pick<BatchChangeListPageProps, 'canCreate'> {}

const BatchChangeListEmptyElement: React.FunctionComponent<
    React.PropsWithChildren<BatchChangeListEmptyElementProps>
> = ({ canCreate }) => {
    const location = useLocation()
    return (
        <div className="w-100 py-5 text-center">
            <Text>
                <strong>No batch changes have been created.</strong>
            </Text>
            {canCreate ? <NewBatchChangeButton to={`${location.pathname}/create`} /> : null}
        </div>
    )
}

const BatchChangeListTabHeader: React.FunctionComponent<
    React.PropsWithChildren<{
        selectedTab: SelectedTab
        setSelectedTab: (selectedTab: SelectedTab) => void
        isSourcegraphDotCom: boolean
    }>
> = ({ selectedTab, setSelectedTab, isSourcegraphDotCom }) => {
    const onSelectBatchChanges = useCallback<React.MouseEventHandler>(
        event => {
            event.preventDefault()
            setSelectedTab('batchChanges')
        },
        [setSelectedTab]
    )
    const onSelectGettingStarted = useCallback<React.MouseEventHandler>(
        event => {
            event.preventDefault()
            setSelectedTab('gettingStarted')
        },
        [setSelectedTab]
    )
    return (
        <nav className="overflow-auto mb-2" aria-label="Batch Changes">
            <div className="nav nav-tabs d-inline-flex d-sm-flex flex-nowrap text-nowrap" role="tablist">
                {!isSourcegraphDotCom && (
                    <div className="nav-item">
                        <Link
                            to=""
                            onClick={onSelectBatchChanges}
                            className={classNames('nav-link', selectedTab === 'batchChanges' && 'active')}
                            aria-selected={selectedTab === 'batchChanges'}
                            role="tab"
                        >
                            <span className="text-content" data-tab-content="All batch changes">
                                All batch changes
                            </span>
                        </Link>
                    </div>
                )}
                <div className="nav-item">
                    <Link
                        to=""
                        onClick={event => {
                            onSelectGettingStarted(event)
                            eventLogger.log('batch_change_homepage:getting_started:clicked')
                        }}
                        className={classNames('nav-link', selectedTab === 'gettingStarted' && 'active')}
                        aria-selected={selectedTab === 'gettingStarted'}
                        role="tab"
                        data-testid="test-getting-started-btn"
                    >
                        <span className="text-content" data-tab-content="Getting started">
                            Getting started
                        </span>
                    </Link>
                </div>
            </div>
        </nav>
    )
}
